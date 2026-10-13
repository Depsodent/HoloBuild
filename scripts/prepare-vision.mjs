import { mkdir, cp, access, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "public", "vision");
await mkdir(target, { recursive: true });
await cp(
  path.join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm"),
  path.join(target, "wasm"),
  { recursive: true },
);
const model = path.join(target, "hand_landmarker.task");
try {
  await access(model);
} catch {
  const response = await fetch(
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  );
  if (!response.ok)
    throw new Error(`Model download failed: ${response.status}`);
  await writeFile(model, new Uint8Array(await response.arrayBuffer()));
}
console.log("Local MediaPipe runtime and version 1 hand model are ready.");
const expected =
  "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1";
if (
  createHash("sha256")
    .update(await readFile(model))
    .digest("hex") !== expected
)
  throw new Error(
    "Hand model checksum mismatch. Remove public/vision/hand_landmarker.task and rerun setup:vision.",
  );
