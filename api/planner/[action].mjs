import { configuration, createPlannerHandler } from "../../server/app.mjs";
let handler;
export default async function planner(req, res) {
  try {
    handler ??= createPlannerHandler(configuration());
    await handler(req, res);
  } catch {
    if (!res.headersSent)
      res.writeHead(503, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
    res.end(
      JSON.stringify({
        error:
          "Planner configuration unavailable. Offline construction remains available.",
      }),
    );
  }
}
