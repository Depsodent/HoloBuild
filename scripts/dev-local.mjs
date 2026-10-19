import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const gemini = process.argv.includes("--gemini");
const owned = [];
const stop = () => {
  for (const child of owned) if (child.exitCode === null) child.kill();
};
process.on("SIGINT", () => {
  stop();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stop();
  process.exit(0);
});
async function available(url, kind) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!r.ok) return false;
    if (kind === "planner") {
      const body = await r.json();
      if (typeof body.configured !== "boolean")
        throw Error("Port 5180 is occupied by an unexpected service.");
      return true;
    }
    if (!(await r.text()).includes("HoloBuild"))
      throw Error("Port 5175 is occupied by another application.");
    return true;
  } catch (error) {
    if (error.message?.includes("occupied")) throw error;
    return false;
  }
}
function start(args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  owned.push(child);
  child.once("error", (error) => {
    console.error(
      "Local service could not start:",
      error.code ?? "process error",
    );
    stop();
    process.exitCode = 1;
  });
  child.once("exit", (code) => {
    if (code) {
      console.error("Local service exited; check the error above.");
      stop();
      process.exitCode = 1;
    }
  });
}
async function wait(url, kind) {
  for (let i = 0; i < 60; i++) {
    if (await available(url, kind)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw Error(
    `${kind} did not become ready; check its configuration and port.`,
  );
}
try {
  if (
    !(await available("http://127.0.0.1:5180/api/planner/status", "planner"))
  ) {
    start([
      `--env-file-if-exists=${gemini ? ".env.gemini.local" : ".env"}`,
      "server/index.mjs",
    ]);
    await wait("http://127.0.0.1:5180/api/planner/status", "planner");
  } else if (gemini)
    console.log(
      "Reusing the running planner. Stop it first to switch provider profiles.",
    );
  if (!(await available("http://127.0.0.1:5175/", "frontend"))) {
    start([
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5175",
      "--strictPort",
    ]);
    await wait("http://127.0.0.1:5175/", "frontend");
  }
  console.log(
    "HoloBuild: http://127.0.0.1:5175/ · Planner: http://127.0.0.1:5180/api/planner/status",
  );
  console.log(
    "Both local services are ready. Check Connection in AI Settings to verify the configured model. Ctrl+C stops services started by this launcher.",
  );
} catch (error) {
  console.error(error.message);
  stop();
  process.exitCode = 1;
}
