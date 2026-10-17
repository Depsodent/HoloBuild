import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
const privateValues = [];
for (const file of [".env", ".env.gemini.local"]) {
  if (!fs.existsSync(file)) continue;
  for (const [name, value] of Object.entries(
    parseEnv(fs.readFileSync(file, "utf8")),
  ))
    if (/(?:KEY|TOKEN|PASSWORD|SECRET)$/.test(name) && value.length >= 12)
      privateValues.push(value);
}

const git = (...args) =>
  execFileSync("git", args, { maxBuffer: 256 * 1024 * 1024 });
const rules = [
  ["Google API key", new RegExp("AI" + "za[0-9A-Za-z_-]{35}")],
  [
    "GitHub token",
    new RegExp(
      "gh[pousr]_" + "[0-9A-Za-z]{30,}|github_pat_" + "[0-9A-Za-z_]{30,}",
    ),
  ],
  [
    "OpenAI-style token",
    new RegExp("sk-" + "(?:proj-|svcacct-)?[0-9A-Za-z_-]{35,}"),
  ],
  ["AWS access key", new RegExp("AK" + "IA[0-9A-Z]{16}")],
  [
    "Private key",
    new RegExp("-----BEGIN " + "(?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
  ],
  ["Credential URL", /https?:\/\/[^\s/:"\x27`]+:[^\s/@"\x27`]{8,}@/],
  [
    "JWT",
    new RegExp(
      "eyJ[a-zA-Z0-9_-]{15,}\\.eyJ[a-zA-Z0-9_-]{15,}\\.[a-zA-Z0-9_-]{20,}",
    ),
  ],
];
const findings = [];
const reviewedFixtures = [];
let blobCount = 0;
const large = [];
function scan(bytes, label) {
  const value = bytes.toString("utf8");
  if (privateValues.some((secret) => value.includes(secret)))
    findings.push({
      file: label,
      rule: "Exact locally configured secret match",
    });
  for (const [rule, pattern] of rules)
    if (pattern.test(value)) {
      // Reviewed negative URL-validation fixture; no real account or credential.
      if (
        rule === "Credential URL" &&
        label.endsWith(":server/app.test.mjs") &&
        value.includes("https://user:" + "password@remote.example/v1") &&
        !pattern.test(
          value.replaceAll("https://user:" + "password@remote.example/v1", ""),
        )
      )
        reviewedFixtures.push({
          file: label,
          rule,
          reason:
            "Intentional URL rejection fixture on reserved .example domain",
        });
      else findings.push({ file: label, rule });
    }
}
const objects = git("rev-list", "--objects", "--all")
  .toString()
  .trim()
  .split(/\r?\n/)
  .map((line) => {
    const i = line.indexOf(" ");
    return {
      id: i < 0 ? line : line.slice(0, i),
      name: i < 0 ? "" : line.slice(i + 1),
    };
  });
const data = execFileSync("git", ["cat-file", "--batch"], {
  input: objects.map((o) => o.id).join("\n") + "\n",
  maxBuffer: 256 * 1024 * 1024,
});
let offset = 0;
for (const obj of objects) {
  const end = data.indexOf(10, offset);
  const header = data.subarray(offset, end).toString();
  const [, type, sizeText] = header.split(" ");
  const size = Number(sizeText);
  offset = end + 1;
  if (type === "blob") {
    blobCount++;
    const label = `history:${obj.id.slice(0, 12)}:${obj.name}`;
    scan(data.subarray(offset, offset + size), label);
    if (size > 5 * 1024 * 1024) large.push({ file: obj.name, bytes: size });
    if (
      /(^|\/)\.env(?:\.|$)/.test(obj.name) &&
      !obj.name.endsWith(".env.example")
    )
      findings.push({
        file: label,
        rule: "Private environment file in history",
      });
  }
  offset += size + 1;
}
const files = git(
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
)
  .toString()
  .split("\0")
  .filter(Boolean);
for (const file of new Set(files)) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
  scan(fs.readFileSync(file), `working:${file}`);
  if (
    /(^|\/)(node_modules|dist|test-results|playwright-report|\.vercel)\//.test(
      file,
    ) ||
    /\.(gguf|safetensors|pem|p12|pfx)$/.test(file)
  )
    findings.push({ file, rule: "Private or generated artifact tracked" });
}
let bundleFiles = 0;
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else {
      bundleFiles++;
      scan(fs.readFileSync(file), `bundle:${file.replaceAll("\\", "/")}`);
    }
  }
}
walk("dist");
const report = {
  auditedAt: new Date().toISOString(),
  baseline: git("rev-parse", "HEAD").toString().trim(),
  workingFiles: new Set(files).size,
  historicalBlobsScanned: blobCount,
  bundleFilesScanned: bundleFiles,
  findings,
  reviewedFixtures,
  largeHistoricalBlobs: large,
  limitations: [
    "Pattern-based audit is not a guarantee that every possible secret is detected.",
    "Author credits, Git author metadata and historical local-path development notes are retained intentionally; no history was rewritten.",
    "Ignored local environment files are excluded from publication and are never printed.",
  ],
};
if (process.argv.includes("--write"))
  fs.writeFileSync(
    "docs/PUBLICATION_AUDIT.json",
    JSON.stringify(report, null, 2) + "\n",
  );
console.log(JSON.stringify(report, null, 2));
if (findings.length || large.length) process.exitCode = 1;
