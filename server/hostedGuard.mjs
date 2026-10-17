import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
// Atomic limits across serverless instances. Failed generation attempts still count.
export const acquireScript = `
redis.call('ZREMRANGEBYSCORE',KEYS[3],'-inf',ARGV[1])
if tonumber(redis.call('GET',KEYS[1]) or '0') >= tonumber(ARGV[3]) then return 0 end
if ARGV[7]=='1' and (tonumber(redis.call('GET',KEYS[2]) or '0') >= tonumber(ARGV[4]) or redis.call('ZCARD',KEYS[3]) >= tonumber(ARGV[5])) then return 0 end
if redis.call('INCR',KEYS[1])==1 then redis.call('EXPIRE',KEYS[1],60) end
if ARGV[7]=='1' then
 if redis.call('INCR',KEYS[2])==1 then redis.call('EXPIRE',KEYS[2],172800) end
 redis.call('ZADD',KEYS[3],tonumber(ARGV[1])+tonumber(ARGV[6]),ARGV[2])
 redis.call('PEXPIRE',KEYS[3],tonumber(ARGV[6])+60000)
end
return 1`;
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
export function createHostedGuard(config, fetcher) {
  const command = async (args) => {
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
  return async (req, generation) => {
    if (!config.publicEnabled) throw Error("Hosted AI is disabled.");
    // Vercel overwrites its forwarded-IP header. Without it, share a conservative bucket.
    const reported = req.headers["x-vercel-forwarded-for"],
      ip = typeof reported === "string" && isIP(reported) ? reported : "shared";
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
    ]);
    if (accepted !== 1) return null;
    return async () => {
      if (generation) await command(["ZREM", leases, lease]);
    };
  };
}
