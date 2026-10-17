export function plannerPreferences() {
  try {
    const p = JSON.parse(localStorage.getItem("holobuild.planner.v1") ?? "{}");
    return {
      timeoutMs:
        Number.isInteger(p.timeoutMs) &&
        p.timeoutMs >= 1000 &&
        p.timeoutMs <= 120000
          ? p.timeoutMs
          : 120000,
    };
  } catch {
    return { timeoutMs: 120000 };
  }
}
export function persistPlanner(timeoutMs: number) {
  try {
    localStorage.setItem("holobuild.planner.v1", JSON.stringify({ timeoutMs }));
  } catch {
    /* Session settings remain usable. */
  }
}
