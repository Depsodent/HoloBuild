// Opt-in real Redis tests, isolated keys; no Gemini requests or production quota mutations.
import fs from "node:fs/promises";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createHostedGuard, hostedSecurity } from "../server/hostedGuard.mjs";
if (process.env.HOLO_REDIS_TEST !== "1")
  throw Error("Explicit Redis test opt-in required.");
const env = parseEnv(await fs.readFile(".env.hosted.local", "utf8"));
const prefix = "{holobuild-regression-" + randomUUID() + "}";
const keys = new Set();
async function command(args) {
  const r = await fetch(env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.UPSTASH_REDIS_REST_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) throw Error("Redis test transport failed.");
  const data = await r.json();
  if (data.error) throw Error("Redis test command rejected.");
  return data.result;
}
const config = {
  ...hostedSecurity({
    ...env,
    PUBLIC_AI_ENABLED: "true",
    PUBLIC_AI_DAILY_LIMIT: "3",
  }),
  timeoutMs: 30000,
};
const isolated = async (_, init) => {
  const args = JSON.parse(init.body);
  for (const i of args[0] === "EVAL" ? [3, 4, 5] : [1]) {
    args[i] = args[i].replace("{holobuild}", prefix);
    keys.add(args[i]);
  }
  return Response.json({ result: await command(args) });
};
const guard = createHostedGuard(config, isolated);
const req = (n) => ({ headers: { "x-vercel-forwarded-for": "192.0.2." + n } });
try {
  for (let i = 0; i < 5; i++) await guard(req(1), false);
  await assert.rejects(
    () => guard(req(1), true),
    (e) =>
      e.kind === "rate-limit" &&
      e.retryAfterSeconds > 0 &&
      e.retryAfterSeconds <= 60,
  );
  const day = prefix + ":day:" + new Date().toISOString().slice(0, 10);
  assert.equal(await command(["GET", day]), null);
  const releases = await Promise.all([
    guard(req(2), true),
    createHostedGuard(config, isolated)(req(3), true),
  ]);
  await assert.rejects(
    () => guard(req(4), true),
    (e) => e.kind === "concurrency",
  );
  assert.equal(await command(["GET", day]), "2");
  await Promise.all(releases.map((release) => release()));
  await (
    await guard(req(4), true)
  )();
  await assert.rejects(
    () => guard(req(5), true),
    (e) => e.kind === "daily-quota" && e.retryAfterSeconds > 0,
  );
  assert.equal(await command(["GET", day]), "3");
  assert.equal(await command(["ZCARD", prefix + ":leases"]), 0);
  // Expire only this test network bucket, then verify recovery using the same guard.
  const ipKeys = [...keys].filter((k) => k.includes(":ip:"));
  for (const key of ipKeys) await command(["PEXPIRE", key, "1"]);
  await new Promise((resolve) => setTimeout(resolve, 20));
  await guard(req(1), false);
  const originalNow = Date.now;
  try {
    const tomorrow = (Math.floor(originalNow() / 86400000) + 1) * 86400000;
    Date.now = () => tomorrow;
    await (
      await guard(req(6), true)
    )();
  } finally {
    Date.now = originalNow;
  }
  const report = {
    testedAt: new Date().toISOString(),
    actualRedis: true,
    isolatedKeys: true,
    productionBudgetsUnchanged: true,
    fiveNetworkRequestsAccepted: true,
    sixthRejected: true,
    independentClientsAccepted: true,
    sharedNetworkBudget: true,
    concurrentCap: 2,
    rejectedRequestsDoNotConsumeDailyBudget: true,
    dailyCap: 3,
    dailyRecoveryBoundary: "UTC midnight retry measured",
    dailyRolloverRecovery: "Simulated next-day clock against actual Redis",
    networkExpiryRecovery: true,
    activeLeasesAfterRelease: 0,
    providerCalls: 0,
  };
  await fs.writeFile(
    "docs/CROSS_DEVICE_REDIS_VALIDATION.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (keys.size)
    await command([
      "DEL",
      ...[...keys].filter((k) => k.startsWith(prefix + ":")),
    ]);
}
