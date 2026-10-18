import { normalizeDesignRequest, requestedAppearance } from "./designLanguage";
import { numeric } from "../commands/parser";
import type {
  AtomicStructureOperation,
  StructureOperation,
} from "../../shared/editSchema.mjs";
import type { BuildingTemplate } from "../../shared/planSchema.mjs";
export type ConversationIntent = {
  kind:
    | "confirm"
    | "cancel"
    | "undo"
    | "redo"
    | "finish"
    | "restart"
    | "explain"
    | "create"
    | "refine"
    | "quick";
  text: string;
};
export function conversationIntent(
  input: string,
  context: boolean,
): ConversationIntent {
  const text = normalizeDesignRequest(input)
      .replace(/^actually[, ]+/i, "")
      .replace(/\b(?:buld|biuld)\b/gi, "build")
      .replace(/\bhous\b/gi, "house"),
    t = text.toLowerCase();
  const kind =
    /^(?:new|start|restart)(?: a)?(?: new)? (?:design|conversation)/.test(t)
      ? "restart"
      : /\b(?:i'm done|i am done|finished|all done)\b/.test(t)
        ? "finish"
        : /^(?:yes|confirm|looks good|perfect|that's good|that is good)$/.test(
              t,
            )
          ? "confirm"
          : /^(?:cancel|reject|never mind|discard)(?: (?:it|that|preview))?$/.test(
                t,
              )
            ? "cancel"
            : /^(?:undo|remove (?:the )?last change)(?: (?:it|that|the last change))?$/.test(
                  t,
                )
              ? "undo"
              : /^redo\b/.test(t)
                ? "redo"
                : /^(?:explain|describe|what (?:is|does)|tell me about)\b/.test(
                      t,
                    )
                  ? "explain"
                  : /^(?:build|generate)\b/.test(t)
                    ? "create"
                    : /^(?:build|generate|create|make)\b.*\b(?:house|building|room|tower|office|warehouse|bridge|shed)\b/.test(
                          t,
                        ) &&
                        (/^(?:build|generate|create)\b/i.test(t) ||
                          !context ||
                          !/\b(?:wider|taller|larger|smaller|purple|blue|yellow|red|green|height)\b/.test(
                            t,
                          ))
                      ? "create"
                      : context &&
                          /\b(?:make|change|give|add|remove|put|increase|decrease|move|rotate|scale|replace|apply|select|duplicate|delete|ungroup|rename)\b/.test(
                            t,
                          )
                        ? "refine"
                        : "quick";
  return { kind, text };
}
export function refinementOperation(
  input: string,
  recipe?: BuildingTemplate,
): { operation?: StructureOperation; message?: string } {
  const t = input.toLowerCase(),
    ops: AtomicStructureOperation[] = [];
  if (/\b(?:balcon|stairs|hinged|opening the door|more modern)/.test(t))
    return {
      message:
        "Balconies, stairs and hinged doors are not supported. I can change window layout, floors, proportions, colors or materials. Which would you like?",
    };
  const appearance = requestedAppearance(t);
  for (const [role, value] of Object.entries(appearance)) {
    if (value.color)
      ops.push({ type: "color", role: role as "wall", color: value.color });
    if (value.material)
      ops.push({
        type: "material",
        role: role as "wall",
        material: value.material,
      });
  }
  const floor = t.match(
    /(?:make(?: it)?|to|be|have|a|another)\s+(one|two|three|four|five|six|\d+)[ -]*(?:stor(?:y|ey|ies|eys)|floors?)\b/,
  );
  if (floor) ops.push({ type: "design", floors: numeric(floor[1]) });
  else if (/\badd\b.*\b(?:another|second|third|a) floor\b/.test(t))
    ops.push(
      /second/.test(t)
        ? { type: "design", floors: 2 }
        : { type: "floors", action: "add" },
    );
  if (/\bincrease (?:the )?height\b/.test(t))
    ops.push({
      type: "floors",
      action: "height",
      height: (recipe?.height ?? 3) + 0.5,
    });
  if (
    recipe &&
    !recipe.windows &&
    !recipe.windowCounts?.some(Boolean) &&
    /\b(?:larger|bigger|smaller) windows?\b/.test(t)
  )
    return {
      message: "This design has no windows. How many should I add per floor?",
    };
  if (
    /\b(?:larger|bigger|smaller) windows?\b|\bwindows? (?:larger|bigger|smaller)\b/.test(
      t,
    )
  )
    ops.push({ type: "design", windowScale: /smaller/.test(t) ? 0.8 : 1.2 });
  else if (
    /\b(?:add|put|remove)\b.*\bwindows?\b|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|\d+) windows?\b/.test(
      t,
    )
  ) {
    const level = t.match(/\b(first|second|third|fourth|fifth|sixth) floor\b/),
      index = level
        ? ["first", "second", "third", "fourth", "fifth", "sixth"].indexOf(
            level[1],
          )
        : undefined;
    const count = t.match(
        /\b(one|two|three|four|five|six|seven|eight|nine|ten|twenty|\d+) windows?\b/,
      ),
      per = t.match(/\b(one|two|three|four|\d+) (?:on )?each floor\b/);
    let n = /\bremove\b/.test(t) ? 0 : count ? numeric(count[1]) : 2;
    if (per) {
      const value = numeric(per[1]);
      if (count && n !== value * (recipe?.floors ?? 1))
        return {
          message:
            "The total window count conflicts with the per-floor count. How many should each floor have?",
        };
      n = value;
    } else if (
      n > 4 &&
      recipe &&
      n % recipe.floors === 0 &&
      index === undefined
    )
      n /= recipe.floors;
    ops.push({
      type: "design",
      windows: n,
      ...(index === undefined ? {} : { level: index }),
    });
  }
  if (/\bmove\b.*\b(?:entrance|door)\b.*\b(left|right)\b/.test(t))
    ops.push({
      type: "design",
      doorOffset:
        (recipe?.doorOffset ?? 0) + (/\bleft\b/.test(t) ? -0.25 : 0.25),
    });
  if (/\bremove\b.*\broof\b/.test(t))
    ops.push({ type: "design", roof: "none" });
  if (/\badd\b.*\b(?:front )?door\b/.test(t))
    ops.push({ type: "design", doors: 1 });
  if (!ops.length) return {};
  return {
    operation: ops.length === 1 ? ops[0] : { type: "batch", operations: ops },
    message:
      "I will preserve the other components. Review the exact preview before confirming. Relative adjustments use height +0.5m, window size ±20% or entrance shift 0.25m where requested.",
  };
}
