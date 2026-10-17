// Read-only checks against the initially disabled production deployment.
import fs from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.HOLO_PUBLIC_URL || "https://holobuild.vercel.app";
const privateValues = [];
for (const file of [".env.gemini.local", ".env.hosted.local"]) {
  for (const [key, value] of Object.entries(
    parseEnv(await fs.readFile(file, "utf8")),
  ))
    if (
      (/KEY|TOKEN/.test(key) || key === "UPSTASH_REDIS_REST_URL") &&
      value.length > 12
    )
      privateValues.push(value);
}
const checks = [];
async function check(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(15000),
    redirect: "manual",
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(
    !privateValues.some((value) => bytes.includes(Buffer.from(value))),
    "Private value found in hosted content.",
  );
  return { response, bytes };
}
const redirect = await check(base.replace("https:", "http:") + "/");
assert.ok([301, 302, 307, 308].includes(redirect.response.status));
assert.ok(redirect.response.headers.get("location")?.startsWith("https://"));
checks.push({ check: "HTTP redirects to HTTPS", passed: true });
const home = await check(base + "/");
assert.equal(home.response.status, 200);
assert.equal(home.response.headers.get("x-content-type-options"), "nosniff");
assert.match(
  home.response.headers.get("permissions-policy"),
  /camera=\(self\)/,
);
assert.match(
  home.response.headers.get("permissions-policy"),
  /microphone=\(self\)/,
);
checks.push({ check: "Anonymous HTTPS and security headers", passed: true });
const status = await check(base + "/api/planner/status");
const health = JSON.parse(status.bytes);
assert.equal(health.provider, "Gemini");
assert.equal(health.model, "gemini-3.5-flash-lite");
assert.equal(health.configured, false);
checks.push({ check: "Public AI initially disabled", passed: true });
const headers = { "Content-Type": "application/json", Origin: base };
const blocked = await check(base + "/api/planner/plan", {
  method: "POST",
  headers,
  body: JSON.stringify({ prompt: "Build a house" }),
});
assert.equal(blocked.response.status, 503);
checks.push({
  check: "Disabled generation rejects without calling provider",
  passed: true,
});
for (const method of ["GET", "POST", "OPTIONS"]) {
  const value = await check(base + "/api/planner/status", {
    method,
    headers: {
      Origin: "https://untrusted.example",
      "Content-Type": "application/json",
    },
    ...(method === "POST" ? { body: "{}" } : {}),
  });
  assert.equal(value.response.status, 403);
  assert.equal(value.response.headers.get("access-control-allow-origin"), null);
}
checks.push({
  check: "Untrusted Origin and CORS preflight denied",
  passed: true,
});
for (const file of [
  "/.env",
  "/.env.gemini.local",
  "/.env.hosted.local",
  "/.git/config",
  "/.cache/vercel-auth/auth.json",
  "/server/app.mjs",
]) {
  const result = await check(base + file);
  assert.equal(result.response.status, 404);
}
checks.push({
  check: "Private local/config/server paths not served",
  passed: true,
});
let scripts = 0;
for (const file of await fs.readdir("dist/assets")) {
  if (!file.endsWith(".js")) continue;
  const local = await fs.readFile(path.join("dist/assets", file));
  const actual = await check(base + "/assets/" + file);
  assert.equal(actual.response.status, 200);
  assert.equal(
    createHash("sha256").update(actual.bytes).digest("hex"),
    createHash("sha256").update(local).digest("hex"),
  );
  scripts++;
}
checks.push({
  check: "Deployed JS matches audited local build and has no private values",
  passed: true,
  scripts,
});
for (const file of [
  "/vision/hand_landmarker.task",
  "/vision/wasm/vision_wasm_internal.wasm",
  "/third-party-notices/index.json",
  "/third-party-notices/distribution.json",
]) {
  const result = await check(base + file);
  assert.equal(result.response.status, 200);
  if (file.endsWith(".wasm"))
    assert.match(
      result.response.headers.get("content-type"),
      /application\/wasm/,
    );
  if (file.endsWith("distribution.json"))
    assert.equal(JSON.parse(result.bytes).excluded[0].renderedBytes, 0);
}
checks.push({
  check: "MediaPipe assets, WASM MIME and license evidence",
  passed: true,
});
const report = {
  checkedAt: new Date().toISOString(),
  url: base,
  initialAIEnabled: false,
  checks,
  geminiCalled: false,
  credentialsPrinted: false,
};
await fs.writeFile(
  "docs/HOSTED_SECURITY_VALIDATION.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));
