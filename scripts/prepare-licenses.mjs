import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
const npmCli = process.env.npm_execpath;
if (!npmCli) throw Error("Run through npm run prepare:licenses.");
const directories = execFileSync(
  process.execPath,
  [npmCli, "ls", "--omit=dev", "--all", "--parseable"],
  { encoding: "utf8" },
)
  .trim()
  .split(/\r?\n/)
  .slice(1);
const output = path.resolve("public/third-party-notices");
await fs.mkdir(output, { recursive: true });
const entries = [];
for (const directory of [...new Set(directories)]) {
  const pkg = JSON.parse(
    await fs.readFile(path.join(directory, "package.json"), "utf8"),
  );
  const files = (await fs.readdir(directory)).filter((name) =>
    /^(licen[sc]e|copying|notice)(?:\..*)?$/i.test(name),
  );
  const safe = pkg.name.replace(/[^a-z0-9.-]/gi, "_");
  const links = [];
  for (const file of files) {
    const stat = await fs.stat(path.join(directory, file));
    if (!stat.isFile()) continue;
    const target = `${safe}-${pkg.version}-${file.replace(/[^a-z0-9.-]/gi, "_")}`;
    await fs.copyFile(path.join(directory, file), path.join(output, target));
    links.push(target);
  }
  const overrides = {
    "@react-three/fiber": "fiber",
    draco3d: "draco",
    maath: "maath",
  };
  if (!links.length && overrides[pkg.name]) {
    const target = `${safe}-${pkg.version}-LICENSE.txt`;
    await fs.copyFile(
      `licenses/${overrides[pkg.name]}-LICENSE.txt`,
      path.join(output, target),
    );
    links.push(target);
  }
  if (pkg.name === "@mediapipe/tasks-vision") {
    const target = "mediapipe-Apache-2.0.txt";
    await fs.copyFile(
      "licenses/mediapipe-LICENSE.txt",
      path.join(output, target),
    );
    links.push(target);
  }
  entries.push({
    name: pkg.name,
    version: pkg.version,
    license: pkg.license ?? "See upstream package",
    files: links,
  });
}
entries.sort((a, b) => a.name.localeCompare(b.name));
await fs.writeFile(
  path.join(output, "index.json"),
  JSON.stringify(
    {
      packages: entries,
      model: {
        name: "MediaPipe Hand Landmarker float16 v1",
        license: "Apache-2.0",
        source:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        licenseFile: "mediapipe-Apache-2.0.txt",
      },
    },
    null,
    2,
  ),
);
console.log(
  `Prepared notices for ${entries.length} production packages; ${entries.filter((e) => !e.files.length).length} rely on package SPDX/upstream notices.`,
);
