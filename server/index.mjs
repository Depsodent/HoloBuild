import { createPlannerServer } from "./app.mjs";
const port = Number(process.env.PLANNER_PORT || 5180);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("Invalid planner port.");
const server = createPlannerServer();
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.timeout = 130000;
server.listen(port, "127.0.0.1", () =>
  console.log(
    `HoloBuild planner listening at http://127.0.0.1:${port} (optional model; no downloads).`,
  ),
);
