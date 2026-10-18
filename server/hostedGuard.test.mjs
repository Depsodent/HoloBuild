import { test } from "node:test";
import assert from "node:assert/strict";
import { clientIdentity, createHostedGuard } from "./hostedGuard.mjs";
const config = {
  publicEnabled: true,
  redisUrl: "https://test.upstash.io",
  redisToken: "test-only-token",
  dailyLimit: 100,
  timeoutMs: 30000,
};
test("trusted identities canonicalize IPv6/mapped IPv4 and ignore proxy spoofing", () => {
  const identity = (value) =>
    clientIdentity({
      "x-vercel-forwarded-for": value,
      "x-forwarded-for": "192.0.2.123",
    });
  assert.equal(identity("2001:0DB8:0:0:0:0:0:1"), identity("2001:db8::1"));
  assert.equal(identity("::ffff:192.0.2.1"), identity("192.0.2.1"));
  assert.equal(identity("192.0.2.1, 192.0.2.2"), "shared");
  assert.equal(identity(undefined), "shared");
  assert.equal(identity("fe80::1%eth0"), "shared");
  assert.equal(identity(["192.0.2.1"]), "shared");
});
test("independent clients use separate private buckets; same-IP clients share one", async () => {
  const calls = [];
  const guard = createHostedGuard(config, async (_, init) => {
    calls.push(JSON.parse(init.body));
    return Response.json({ result: [1, 0] });
  });
  for (const ip of ["192.0.2.1", "192.0.2.2", "192.0.2.1"])
    await (
      await guard({ headers: { "x-vercel-forwarded-for": ip } }, true)
    )();
  const evals = calls.filter((c) => c[0] === "EVAL");
  assert.notEqual(evals[0][3], evals[1][3]);
  assert.equal(evals[0][3], evals[2][3]);
  assert.ok(!JSON.stringify(calls).includes("192.0.2"));
  assert.equal(evals[0][8], "5");
  assert.equal(evals[0][9], "100");
  assert.equal(evals[0][10], "2");
});
test("quota classes carry measured retry delays, recover without removing safeguards", async () => {
  let result = [2, 17];
  const guard = createHostedGuard(config, async () =>
    Response.json({ result }),
  );
  for (const [code, kind] of [
    [2, "rate-limit"],
    [3, "daily-quota"],
    [4, "concurrency"],
  ]) {
    result = [code, 17];
    await assert.rejects(
      () => guard({ headers: {} }, true),
      (e) => e.status === 429 && e.kind === kind && e.retryAfterSeconds === 17,
    );
  }
  result = [1, 0];
  assert.equal(typeof (await guard({ headers: {} }, false)), "function");
});
test("temporary store failure is distinct, fail-closed and recovers on the next request", async () => {
  let broken = true;
  const guard = createHostedGuard(config, async () => {
    if (broken) throw Error("private-token-url");
    return Response.json({ result: [1, 0] });
  });
  await assert.rejects(
    () => guard({ headers: {} }, true),
    (e) =>
      e.status === 503 &&
      e.kind === "quota-store" &&
      !e.message.includes("private-token"),
  );
  broken = false;
  assert.equal(typeof (await guard({ headers: {} }, true)), "function");
});
