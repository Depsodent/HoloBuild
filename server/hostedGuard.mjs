import { PlannerError } from "./plannerError.mjs";
import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
// Atomic limits across serverless instances. Failed generation attempts still count.
export const acquireScript = `
redis.call('ZREMRANGEBYSCORE',KEYS[3],'-inf',ARGV[1])
if tonumber(redis.call('GET',KEYS[1]) or '0') >= tonumber(ARGV[3]) then return {2,math.max(1,redis.call('TTL',KEYS[1]))} end
if ARGV[7]=='1' and tonumber(redis.call('GET',KEYS[2]) or '0') >= tonumber(ARGV[4]) then return {3,tonumber(ARGV[8])} end
if ARGV[7]=='1' and redis.call('ZCARD',KEYS[3]) >= tonumber(ARGV[5]) then
 local first=redis.call('ZRANGE',KEYS[3],0,0,'WITHSCORES')
 return {4,math.max(1,math.ceil((tonumber(first[2])-tonumber(ARGV[1]))/1000))}
end
if redis.call('INCR',KEYS[1])==1 then redis.call('EXPIRE',KEYS[1],60) end
if ARGV[7]=='1' then
 if redis.call('INCR',KEYS[2])==1 then redis.call('EXPIRE',KEYS[2],172800) end
 redis.call('ZADD',KEYS[3],tonumber(ARGV[1])+tonumber(ARGV[6]),ARGV[2])
 redis.call('PEXPIRE',KEYS[3],tonumber(ARGV[6])+60000)
end
return {1,0}`;
export function hostedSecurity(env) {
  const url = env.UPSTASH_REDIS_REST_URL || "",
    token = env.UPSTASH_REDIS_REST_TOKEN || "";
  if (url) {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "https:" ||
      !parsed.hostname.endsWith(".upstash.io") ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== "/" ||
      parsed.port
    )
      throw Error("Invalid rate-limit service configuration.");
  }
  const limit = Number(env.PUBLIC_AI_DAILY_LIMIT || 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000)
    throw Error("Daily AI limit must be 1–1000.");
  return {
    redisUrl: url.replace(/\/$/, ""),
    redisToken: token,
    dailyLimit: limit,
    publicEnabled: env.PUBLIC_AI_ENABLED === "true" && !!url && !!token,
  };
}
// Only Vercel's overwritten header is trusted. Invalid/missing values share a fail-safe bucket.
export function clientIdentity(headers) {
  const raw = headers["x-vercel-forwarded-for"];
  if (typeof raw !== "string" || raw.includes("%") || !isIP(raw.trim()))
    return "shared";
  const ip = raw.trim();
  if (isIP(ip) === 4) return ip;
  const canonical = new URL("http://[" + ip + "]").hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(canonical);
  if (mapped) {
    const a = parseInt(mapped[1], 16),
      b = parseInt(mapped[2], 16);
    return [a >> 8, a & 255, b >> 8, b & 255].join(".");
  }
  return canonical;
}
export function createHostedGuard(config, fetcher) {
  const rawCommand = async (args) => {
    const response = await fetcher(config.redisUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.redisToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      redirect: "error",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw Error("Rate-limit store unavailable.");
    const reader = response.body?.getReader();
    if (!reader) throw Error("Missing rate-limit response.");
    const chunks = [];
    let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 4096) throw Error("Rate-limit response limit.");
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (result.error) throw Error("Rate-limit command failed.");
    return result.result;
  };
  const command = async (args) => {
    try {
      return await rawCommand(args);
    } catch {
      throw new PlannerError(
        503,
        "quota-store",
        "AI safety service temporarily unavailable; retry in 5 seconds or use Offline.",
        5,
      );
    }
  };
  return async (req, generation) => {
    if (!config.publicEnabled) throw Error("Hosted AI is disabled.");
    const ip = clientIdentity(req.headers);
    const hash = createHmac("sha256", config.redisToken)
        .update(ip)
        .digest("hex"),
      now = Date.now(),
      lease = randomUUID(),
      day = new Date(now).toISOString().slice(0, 10),
      leases = "{holobuild}:leases";
    const accepted = await command([
      "EVAL",
      acquireScript,
      "3",
      `{holobuild}:ip:${hash}`,
      `{holobuild}:day:${day}`,
      leases,
      String(now),
      lease,
      "5",
      String(config.dailyLimit),
      "2",
      String(config.timeoutMs + 10000),
      generation ? "1" : "0",
      String(86400 - (Math.floor(now / 1000) % 86400)),
    ]);
    const [code, seconds] = Array.isArray(accepted)
      ? accepted
      : [accepted === 1 ? 1 : 2, 60];
    if (code !== 1) {
      const retry = Math.max(1, Math.ceil(Number(seconds) || 60));
      const kind =
        code === 3 ? "daily-quota" : code === 4 ? "concurrency" : "rate-limit";
      const reason =
        code === 3
          ? "Daily public AI budget reached"
          : code === 4
            ? "AI is busy"
            : "Too many requests on this network";
      throw new PlannerError(
        429,
        kind,
        reason + "; retry in " + retry + " seconds or use Offline.",
        retry,
      );
    }
    return async () => {
      if (generation) await command(["ZREM", leases, lease]);
    };
  };
}
