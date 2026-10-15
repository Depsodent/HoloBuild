import type { ObjectType } from "../scene/objectTypes";
import {
  MATERIAL_IDS,
  MATERIAL_PRESETS,
  type MaterialId,
} from "../scene/materialPresets";
export type Intent =
  | { type: "create"; shape: ObjectType }
  | { type: "select"; target: string }
  | {
      type:
        | "deselect"
        | "undo"
        | "redo"
        | "save"
        | "delete"
        | "duplicate"
        | "clear";
    }
  | { type: "move"; direction: string; amount: number }
  | { type: "rotate" | "scale"; amount: number }
  | { type: "color"; color: string }
  | { type: "material"; material: MaterialId };
export function normalize(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .trim();
}
const words: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
export function numeric(text: string): number {
  text = text.trim();
  const sign = /^(?:-|minus |negative )/.test(text) ? -1 : 1;
  text = text.replace(/^(?:-|minus |negative )/, "").replace(/-/g, " ");
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text) * sign;
  const decimal = text.split(" point ");
  if (decimal.length > 2) return NaN;
  let total = 0,
    part = 0;
  const tokens = decimal[0].split(" ");
  // Limited number grammar: no arbitrary expressions or transcription guessing.
  if (
    !/^(?:(?:one|two|three|four|five|six|seven|eight|nine) hundred(?: and)?(?: )?)?(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(?: (?:one|two|three|four|five|six|seven|eight|nine))?)?$/.test(
      decimal[0],
    ) ||
    !decimal[0]
  )
    return NaN;
  for (const t of tokens) {
    if (t === "and") continue;
    if (t === "hundred") {
      total += part * 100;
      part = 0;
    } else part += words[t] ?? NaN;
  }
  total += part;
  if (decimal[1] !== undefined) {
    const digits = decimal[1].split(" ").map((t) => words[t]);
    if (!digits.length || digits.some((d) => d === undefined || d > 9))
      return NaN;
    total += Number("0." + digits.join(""));
  }
  return total * sign;
}
export const COLORS: Record<string, string> = {
  red: "#ff0000",
  blue: "#0000ff",
  green: "#008000",
  yellow: "#ffff00",
  orange: "#ffa500",
  purple: "#800080",
  pink: "#ffc0cb",
  white: "#ffffff",
  black: "#000000",
  gray: "#808080",
  grey: "#808080",
  cyan: "#00ffff",
  teal: "#008080",
};
const ref =
  "(?:(?:the )?(?:selected object|selected|object|this object|that object|this|that|it) )?";
export function parseCommand(input: string): Intent {
  if (input.length > 240)
    throw Error("Command is too long (maximum 240 characters).");
  const t = normalize(input);
  let m: RegExpMatchArray | null;
  if (
    (m = t.match(
      /^(?:create|add|make|insert) (?:a |an |the )?(cube|sphere|cylinder|cone|wall|floor)$/,
    ))
  )
    return { type: "create", shape: m[1] as ObjectType };
  if (
    /^(?:deselect|clear selection|deselect (?:all|everything|the selected object))$/.test(
      t,
    )
  )
    return { type: "deselect" };
  if (/^(?:undo|undo last action)$/.test(t)) return { type: "undo" };
  if (/^(?:redo|redo last action)$/.test(t)) return { type: "redo" };
  if (/^save(?: the)?(?: scene| project)?$/.test(t)) return { type: "save" };
  if (/^(?:clear|reset)(?: the)? scene$/.test(t)) return { type: "clear" };
  if ((m = t.match(/^select (?:the )?(?:object (?:named |with id )?)?(.+)$/))) {
    const target = m[1].replace(/^"(.*)"$/, "$1");
    return {
      type: "select",
      target: /^(?:last|last created|last created object|newest object)$/.test(
        target,
      )
        ? "last"
        : target,
    };
  }
  if (
    /^(?:delete|remove)(?: (?:the )?(?:selected object|selected|object|this object|that object|this|that|it))?$/.test(
      t,
    )
  )
    return { type: "delete" };
  if (
    /^(?:duplicate|copy)(?: (?:the )?(?:selected object|selected|object|this object|that object|this|that|it))?$/.test(
      t,
    )
  )
    return { type: "duplicate" };
  // The optional reference includes its trailing separator; suffix forms use a separate grammar.
  if (
    (m = t.match(
      new RegExp(
        "^(?:move|translate) " +
          ref +
          "(left|right|up|down|forward|forwards|back|backward|backwards) (?:by )?(.+?)(?: (meters?|metres?|m|centimeters?|centimetres?|cm|millimeters?|millimetres?|mm|feet|foot|ft|inches?|in))?$",
      ),
    ))
  ) {
    const units = m[3] ?? "m",
      factor = /^(?:cm|centi)/.test(units)
        ? 0.01
        : /^(?:mm|milli)/.test(units)
          ? 0.001
          : /^(?:feet|foot|ft)$/.test(units)
            ? 0.3048
            : /^(?:in|inch)/.test(units)
              ? 0.0254
              : 1;
    const amount = numeric(m[2]) * factor;
    if (!Number.isFinite(amount) || amount <= 0 || amount > 50)
      throw Error(
        "Move distance must be greater than 0 and at most 50 metres.",
      );
    return { type: "move", direction: m[1], amount };
  }
  if (
    (m = t.match(
      new RegExp(
        "^(rotate|turn|scale|resize) " +
          ref +
          "(?:by )?(.+?)(?: (degrees?|deg|times|x))?$",
      ),
    ))
  ) {
    const type = /^(rotate|turn)$/.test(m[1]) ? "rotate" : "scale",
      amount = numeric(m[2]);
    if (
      (type === "scale" && m[3] && !["times", "x"].includes(m[3])) ||
      (type === "rotate" && m[3] && ["times", "x"].includes(m[3]))
    )
      throw Error("Use degrees for rotation and a factor for scale.");
    if (
      !Number.isFinite(amount) ||
      (type === "scale"
        ? amount <= 0 || amount > 20
        : amount === 0 || Math.abs(amount) > 3600)
    )
      throw Error(
        type === "scale"
          ? "Scale factor must be greater than 0 and at most 20."
          : "Angle must be nonzero and at most ±3600 degrees.",
      );
    return { type, amount };
  }
  const colorMatch =
    t.match(new RegExp("^make " + ref + "(?:color )?([a-z]+|#[a-f0-9]{6})$")) ??
    t.match(
      /^(?:change|set) (?:(?:the )?(?:selected object|object|its|this|that) )?colou?r to ([a-z]+|#[a-f0-9]{6})$/,
    );
  if (colorMatch) {
    const color =
      COLORS[colorMatch[1]] ??
      (/^#[a-f0-9]{6}$/.test(colorMatch[1]) ? colorMatch[1] : null);
    if (!color)
      throw Error("Unsupported color. Use a listed color or #RRGGBB.");
    return { type: "color", color };
  }
  if (
    (m = t.match(
      /^(?:apply (.+?)(?: material)?|(?:change|set) (?:(?:its|the) )?material to (.+?))$/,
    ))
  ) {
    const name = m[1] ?? m[2],
      material = MATERIAL_IDS.find(
        (id) =>
          id === name || MATERIAL_PRESETS[id].label.toLowerCase() === name,
      );
    if (!material)
      throw Error("Unsupported material. Use an existing material preset.");
    return { type: "material", material };
  }
  throw Error(
    "Unsupported command. Use one command at a time; see Command examples.",
  );
}
