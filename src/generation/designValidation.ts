import { Color } from "three";
import type { ConstructionPlan } from "../../shared/planSchema.mjs";
import { numeric } from "../commands/parser";
import { normalizeDesignRequest, requestedAppearance } from "./designLanguage";
/** Reject omitted explicit requirements; never rewrite a provider's geometry. */
export function validateDesignAttributes(
  input: string,
  plan: ConstructionPlan,
) {
  const text = normalizeDesignRequest(input).toLowerCase();
  const floor = text.match(
    /\b(one|two|three|four|five|six|\d+)[ -]*(?:stories|story|storeys|storey|floors?)\b/,
  );
  const floorHeights = [
    ...new Set(
      plan.objects
        .filter((p) => p.role === "floor")
        .map((p) => Number(p.position[1].toFixed(4))),
    ),
  ].sort((a, b) => a - b);
  if (floor) {
    const actual = floorHeights.length;
    if (actual !== numeric(floor[1]))
      throw Error(
        "Generated plan omitted the requested floor count. Request a new preview; the scene is unchanged.",
      );
  }
  const windows = text.match(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|\d+) windows?\b/,
  );
  const per = text.match(
    /\b(one|two|three|four|\d+) (?:windows? )?(?:(?:on )?(?:each|every)|per) floor\b/,
  );
  const panels = plan.objects.filter((p) => p.role === "window");
  if (
    windows &&
    !/\bwindows? (?:on |per )?(?:each|every) floor\b/.test(
      windows[0] + text.slice((windows.index ?? 0) + windows[0].length),
    ) &&
    panels.length !== numeric(windows[1])
  )
    throw Error(
      "Generated plan omitted the requested total window count. Scene unchanged.",
    );
  if (per) {
    const count = numeric(per[1]);
    const levels = floorHeights.length;
    for (let i = 0; i < levels; i++)
      if (panels.filter((p) => (p.level ?? 0) === i).length !== count)
        throw Error(
          "Generated plan omitted the requested windows per floor. Scene unchanged.",
        );
  }
  if (
    per &&
    panels.some((p) => {
      const level = p.level ?? 0;
      return (
        floorHeights[level] === undefined ||
        p.position[1] <= floorHeights[level] ||
        (floorHeights[level + 1] !== undefined &&
          p.position[1] >= floorHeights[level + 1])
      );
    })
  )
    throw Error(
      "Generated windows are not on the requested floor elevations. Scene unchanged.",
    );
  for (const [role, value] of Object.entries(requestedAppearance(text))) {
    const parts = plan.objects.filter((p) => p.role === role);
    if (!parts.length)
      throw Error(
        "Generated plan omitted the requested " + role + ". Scene unchanged.",
      );
    if (value.material && parts.some((p) => p.material !== value.material))
      throw Error(
        "Generated plan omitted the requested " +
          role +
          " material. Scene unchanged.",
      );
    if (value.color) {
      const expected = new Color(value.color).getHSL({ h: 0, s: 0, l: 0 });
      if (
        parts.some((p) => {
          const c = new Color(p.color).getHSL({ h: 0, s: 0, l: 0 });
          return expected.s < 0.15
            ? Math.abs(c.l - expected.l) > 0.2
            : c.s < 0.2 ||
                Math.min(
                  Math.abs(c.h - expected.h),
                  1 - Math.abs(c.h - expected.h),
                ) > 0.1;
        })
      )
        throw Error(
          "Generated plan omitted the requested " +
            role +
            " color. Scene unchanged.",
        );
    }
  }
}
