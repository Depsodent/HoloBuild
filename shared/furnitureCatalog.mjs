// Native low-poly recipes; metres, +Z front, base at Y=0. No external assets.
const box = (x, y, z, w, h, d, tone = 0) => ({
  shape: "box",
  position: [x, y, z],
  size: [w, h, d],
  tone,
});
const cyl = (x, y, z, w, h, d, tone = 2) => ({
  shape: "cylinder",
  position: [x, y, z],
  size: [w, h, d],
  tone,
});
const ball = (x, y, z, w, h, d, tone = 0) => ({
  shape: "sphere",
  position: [x, y, z],
  size: [w, h, d],
  tone,
});
const legs = (w, h, d) =>
  [-1, 1].flatMap((x) =>
    [-1, 1].map((z) =>
      box(x * (w / 2 - 0.07), h / 2, z * (d / 2 - 0.07), 0.07, h, 0.07, 2),
    ),
  );
const table = (w = 1.2, h = 0.75, d = 0.7) => [
  ...legs(w, h - 0.07, d),
  box(0, h - 0.035, 0, w, 0.07, d),
];
const chair = (office = false) => [
  ...legs(0.48, 0.43, 0.48),
  box(0, 0.46, 0, 0.5, 0.09, 0.5),
  box(0, 0.78, -0.21, 0.5, 0.55, 0.08),
  ...(office
    ? [
        box(-0.28, 0.64, 0, 0.07, 0.06, 0.4, 2),
        box(0.28, 0.64, 0, 0.07, 0.06, 0.4, 2),
      ]
    : []),
];
const cabinet = (w = 1, h = 1.8, d = 0.5, shelves = false) => [
  box(0, 0.06, 0, w, 0.12, d, 2),
  box(0, h - 0.04, 0, w, 0.08, d),
  box(-w / 2 + 0.04, h / 2, 0, 0.08, h, d),
  box(w / 2 - 0.04, h / 2, 0, 0.08, h, d),
  box(0, h / 2, -d / 2 + 0.025, w, h, 0.05),
  ...(shelves
    ? [0.25, 0.5, 0.75].map((f) => box(0, h * f, 0, w, 0.05, d))
    : [
        box(-w / 4, h / 2, d / 2, w / 2 - 0.015, h - 0.15, 0.035, 1),
        box(w / 4, h / 2, d / 2, w / 2 - 0.015, h - 0.15, 0.035, 1),
        box(-0.05, h / 2, d / 2 + 0.03, 0.025, 0.2, 0.025, 2),
        box(0.05, h / 2, d / 2 + 0.03, 0.025, 0.2, 0.025, 2),
      ]),
];
const sofa = (w = 1.7) => [
  ...legs(w, 0.12, 0.82),
  box(0, 0.29, 0, w, 0.34, 0.82),
  box(0, 0.66, -0.34, w, 0.65, 0.17),
  box(-w / 2 + 0.09, 0.51, 0, 0.18, 0.5, 0.84),
  box(w / 2 - 0.09, 0.51, 0, 0.18, 0.5, 0.84),
  ...[-1, 1].map((i) =>
    box((i * (w - 0.4)) / 4, 0.5, 0.07, (w - 0.42) / 2, 0.17, 0.64, 1),
  ),
];
const bed = (w = 1.4) => [
  ...legs(w, 0.2, 2),
  box(0, 0.25, 0, w, 0.15, 2, 2),
  box(0, 0.43, 0, w, 0.24, 1.95, 1),
  box(0, 0.89, -0.97, w, 0.98, 0.1),
  box(0, 0.62, -0.65, w * 0.8, 0.15, 0.42, 1),
  box(0, 0.59, 0.3, w, 0.06, 1.25),
];
const lamp = (h = 1.5) => [
  cyl(0, 0.035, 0, 0.32, 0.07, 0.32),
  cyl(0, h * 0.46, 0, 0.035, h * 0.9, 0.035),
  {
    shape: "cone",
    position: [0, h - 0.18, 0],
    size: [0.38, 0.36, 0.38],
    tone: 1,
  },
];
const defs = [];
function add(
  id,
  name,
  category,
  size,
  parts,
  attachment = "floor",
  color = "#579b9c",
  material = "matte-plastic",
) {
  defs.push({ id, name, category, size, parts, attachment, color, material });
}
const L = "Living Room",
  B = "Bedroom",
  K = "Kitchen and Dining",
  A = "Bathroom",
  O = "Office and Study",
  D = "Decor and Utility";
add("sofa-two", "Two-seat sofa", L, [1.7, 1, 0.84], sofa());
add("sofa-three", "Three-seat sofa", L, [2.3, 1, 0.84], sofa(2.3));
add(
  "sectional",
  "Sectional sofa",
  L,
  [2.5, 1, 1.65],
  [
    ...sofa(2.5),
    box(0.85, 0.32, 0.75, 0.8, 0.45, 1),
    box(0.85, 0.57, 0.75, 0.75, 0.14, 1, 1),
  ],
);
add("armchair", "Armchair", L, [0.9, 1, 0.84], sofa(0.9));
add(
  "coffee-table",
  "Coffee table",
  L,
  [1.1, 0.42, 0.6],
  table(1.1, 0.42, 0.6),
  "floor",
  "#b58c65",
  "wood",
);
add(
  "side-table",
  "Side table",
  L,
  [0.5, 0.55, 0.5],
  table(0.5, 0.55, 0.5),
  "floor",
  "#b58c65",
  "wood",
);
add(
  "tv-stand",
  "TV stand",
  L,
  [1.5, 0.5, 0.45],
  cabinet(1.5, 0.5, 0.45, true),
  "floor",
  "#a17d60",
  "wood",
);
add(
  "television",
  "Television",
  L,
  [1.1, 0.75, 0.22],
  [
    box(0, 0.44, 0, 1.1, 0.62, 0.07, 2),
    box(0, 0.44, 0.043, 1.02, 0.54, 0.015, 3),
    box(0, 0.08, 0, 0.06, 0.15, 0.06, 2),
    box(0, 0.025, 0, 0.45, 0.05, 0.22, 2),
  ],
  "surface",
  "#26323f",
);
add(
  "bookshelf",
  "Bookshelf",
  L,
  [0.95, 1.85, 0.38],
  [
    ...cabinet(0.95, 1.85, 0.38, true),
    ...[0, 1, 2].flatMap((i) => [
      box(-0.23, 0.62 + i * 0.45, 0, 0.12, 0.32, 0.2, 1),
      box(-0.07, 0.6 + i * 0.45, 0, 0.12, 0.28, 0.2, 0),
    ]),
  ],
  "floor",
  "#b58c65",
  "wood",
);
add("floor-lamp", "Floor lamp", L, [0.38, 1.5, 0.38], lamp());
add(
  "rug",
  "Rug",
  L,
  [2, 0.025, 1.4],
  [
    box(0, 0.0125, 0, 2, 0.025, 1.4),
    box(0, 0.026, 0, 1.78, 0.002, 1.18, 1),
    box(0, 0.028, 0, 0.12, 0.002, 1.18, 2),
  ],
  "floor",
  "#8c607b",
);
add("bed-single", "Single bed", B, [0.95, 1.38, 2.07], bed(0.95));
add("bed-double", "Double bed", B, [1.6, 1.38, 2.07], bed(1.6));
add(
  "bunk-bed",
  "Bunk bed",
  B,
  [1.05, 1.95, 2.1],
  [
    ...bed(0.95),
    ...bed(0.95).map((p) => ({
      ...p,
      position: [p.position[0], p.position[1] + 1, p.position[2]],
    })),
    ...[-0.46, 0.46].flatMap((x) =>
      [-0.97, 0.97].map((z) => box(x, 0.95, z, 0.06, 1.9, 0.06, 2)),
    ),
    ...[0, 1, 2, 3, 4].map((i) =>
      box(0.53, 0.25 + i * 0.3, 0.85, 0.06, 0.04, 0.4, 2),
    ),
  ],
);
add(
  "wardrobe",
  "Wardrobe",
  B,
  [1.3, 2, 0.58],
  cabinet(1.3, 2, 0.52),
  "floor",
  "#c0a17b",
  "wood",
);
add(
  "bedside-table",
  "Bedside table",
  B,
  [0.48, 0.55, 0.42],
  cabinet(0.48, 0.55, 0.36),
  "floor",
  "#b58c65",
  "wood",
);
add(
  "dresser",
  "Dresser",
  B,
  [1.1, 0.9, 0.5],
  [
    ...cabinet(1.1, 0.9, 0.44),
    ...[0.25, 0.5, 0.75].map((y) => box(0, y, 0.28, 0.7, 0.035, 0.025, 2)),
  ],
  "floor",
  "#b58c65",
  "wood",
);
add(
  "study-desk",
  "Study desk",
  B,
  [1.2, 0.75, 0.65],
  table(1.2, 0.75, 0.65),
  "floor",
  "#b58c65",
  "wood",
);
add(
  "desk-chair",
  "Desk chair",
  B,
  [0.5, 1.055, 0.5],
  [...chair(), box(0, 0.53, 0, 0.45, 0.06, 0.45, 1)],
);
add(
  "floor-mirror",
  "Floor mirror",
  B,
  [0.65, 1.7, 0.18],
  [
    box(0, 0.85, 0, 0.65, 1.7, 0.08),
    box(0, 0.9, 0.046, 0.54, 1.45, 0.015, 3),
    box(0, 0.04, 0, 0.6, 0.08, 0.18, 2),
  ],
);
add(
  "dining-table",
  "Dining table",
  K,
  [1.6, 0.78, 0.9],
  table(1.6, 0.78, 0.9),
  "floor",
  "#b58c65",
  "wood",
);
add(
  "dining-chair",
  "Dining chair",
  K,
  [0.5, 1.055, 0.5],
  chair(),
  "floor",
  "#b58c65",
  "wood",
);
add(
  "kitchen-counter",
  "Kitchen counter",
  K,
  [1.2, 0.9, 0.65],
  [...cabinet(1.2, 0.85, 0.58), box(0, 0.88, 0, 1.2, 0.04, 0.65, 1)],
);
add(
  "kitchen-cabinet",
  "Kitchen cabinet",
  K,
  [0.8, 0.7, 0.35],
  cabinet(0.8, 0.7, 0.29),
  "wall",
);
add(
  "refrigerator",
  "Refrigerator",
  K,
  [0.7, 1.85, 0.7],
  [
    box(0, 0.925, 0, 0.7, 1.85, 0.62, 1),
    box(0, 0.4, 0.33, 0.68, 0.75, 0.04),
    box(0, 1.28, 0.33, 0.68, 0.9, 0.04),
    box(0.22, 1.22, 0.37, 0.035, 0.4, 0.03, 2),
  ],
);
add(
  "stove",
  "Stove / cooktop",
  K,
  [0.7, 0.9, 0.65],
  [
    ...cabinet(0.7, 0.87, 0.58),
    box(0, 0.89, 0, 0.7, 0.02, 0.65, 2),
    ...[-1, 1].flatMap((x) =>
      [-1, 1].map((z) => cyl(x * 0.18, 0.91, z * 0.16, 0.18, 0.025, 0.18, 3)),
    ),
    box(0, 0.44, 0.326, 0.48, 0.4, 0.012, 3),
  ],
);
add(
  "sink",
  "Sink",
  K,
  [0.8, 0.98, 0.62],
  [
    ...cabinet(0.8, 0.85, 0.56),
    box(0, 0.87, 0, 0.8, 0.04, 0.62, 1),
    box(0, 0.9, 0, 0.5, 0.03, 0.35, 3),
    cyl(0, 0.94, -0.23, 0.04, 0.08, 0.04, 2),
  ],
);
add(
  "kitchen-island",
  "Kitchen island",
  K,
  [1.5, 0.94, 0.85],
  [...cabinet(1.4, 0.9, 0.75), box(0, 0.92, 0, 1.5, 0.04, 0.85, 1)],
);
add(
  "bar-stool",
  "Bar stool",
  K,
  [0.42, 0.8, 0.42],
  [...legs(0.4, 0.72, 0.4), cyl(0, 0.76, 0, 0.42, 0.08, 0.42)],
);
add(
  "toilet",
  "Toilet",
  A,
  [0.48, 0.82, 0.72],
  [
    cyl(0, 0.22, 0.1, 0.38, 0.44, 0.48, 1),
    cyl(0, 0.46, 0.12, 0.48, 0.08, 0.58, 1),
    box(0, 0.58, -0.24, 0.43, 0.48, 0.2, 1),
    box(0, 0.84, -0.24, 0.45, 0.04, 0.23),
  ],
);
add(
  "washbasin",
  "Washbasin",
  A,
  [0.6, 0.88, 0.5],
  [
    cyl(0, 0.38, 0, 0.18, 0.76, 0.18, 1),
    cyl(0, 0.8, 0, 0.6, 0.16, 0.5, 1),
    cyl(0, 0.89, -0.16, 0.04, 0.1, 0.04, 2),
  ],
);
add(
  "shower",
  "Shower enclosure",
  A,
  [0.9, 2, 0.9],
  [
    box(0, 0.04, 0, 0.9, 0.08, 0.9, 1),
    box(-0.43, 1, 0, 0.04, 2, 0.9, 3),
    box(0, 1, -0.43, 0.9, 2, 0.04, 3),
    cyl(0.35, 1.4, -0.35, 0.035, 1.1, 0.035, 2),
    box(0.35, 1.93, -0.2, 0.22, 0.04, 0.3, 2),
  ],
);
add(
  "bathtub",
  "Bathtub",
  A,
  [1.7, 0.6, 0.8],
  [
    box(0, 0.08, 0, 1.7, 0.16, 0.8, 1),
    box(-0.8, 0.35, 0, 0.1, 0.5, 0.8, 1),
    box(0.8, 0.35, 0, 0.1, 0.5, 0.8, 1),
    box(0, 0.35, -0.35, 1.5, 0.5, 0.1, 1),
    box(0, 0.35, 0.35, 1.5, 0.5, 0.1, 1),
    box(0, 0.17, 0, 1.48, 0.02, 0.58, 3),
  ],
);
add(
  "bath-mirror",
  "Bathroom mirror",
  A,
  [0.65, 0.8, 0.05],
  [
    box(0, 0.4, 0, 0.65, 0.8, 0.05),
    box(0, 0.4, 0.03, 0.58, 0.72, 0.012, 3),
    box(0, 0.79, 0.035, 0.65, 0.02, 0.03, 2),
  ],
  "wall",
);
add(
  "bath-cabinet",
  "Bathroom cabinet",
  A,
  [0.6, 0.8, 0.35],
  cabinet(0.6, 0.8, 0.29),
  "wall",
);
add(
  "office-desk",
  "Office desk",
  O,
  [1.4, 0.76, 0.7],
  [...table(1.4, 0.76, 0.7), box(0.46, 0.43, 0, 0.4, 0.6, 0.58, 1)],
  "floor",
  "#b58c65",
  "wood",
);
add(
  "ergonomic-chair",
  "Ergonomic chair",
  O,
  [0.63, 1.1, 0.6],
  [
    ...chair(true),
    box(0, 1.02, -0.21, 0.36, 0.16, 0.09, 1),
    cyl(0, 0.2, 0, 0.06, 0.4, 0.06, 2),
    box(0, 0.035, 0, 0.63, 0.07, 0.6, 2),
  ],
);
add(
  "filing-cabinet",
  "Filing cabinet",
  O,
  [0.5, 1.1, 0.5],
  [
    ...cabinet(0.5, 1.1, 0.44),
    ...[0.3, 0.65, 0.95].map((y) => box(0, y, 0.28, 0.2, 0.025, 0.03, 2)),
  ],
);
add(
  "monitor",
  "Computer monitor",
  O,
  [0.6, 0.5, 0.22],
  [
    box(0, 0.3, 0, 0.6, 0.36, 0.05, 2),
    box(0, 0.3, 0.03, 0.55, 0.3, 0.01, 3),
    box(0, 0.1, 0, 0.04, 0.2, 0.04, 2),
    box(0, 0.015, 0, 0.3, 0.03, 0.22, 2),
  ],
  "surface",
);
add(
  "plant",
  "Indoor plant",
  D,
  [0.55, 1.15, 0.55],
  [
    cyl(0, 0.18, 0, 0.32, 0.36, 0.32, 1),
    cyl(0, 0.6, 0, 0.03, 0.7, 0.03, 2),
    ball(-0.12, 0.75, 0, 0.35, 0.5, 0.25),
    ball(0.14, 0.93, 0.02, 0.35, 0.4, 0.3),
  ],
  "floor",
  "#409b62",
);
add(
  "wall-clock",
  "Wall clock",
  D,
  [0.38, 0.38, 0.07],
  [
    {
      shape: "cylinder",
      position: [0, 0.19, 0],
      size: [0.38, 0.07, 0.38],
      rotation: [Math.PI / 2, 0, 0],
      tone: 1,
    },
    box(0, 0.24, 0.045, 0.02, 0.14, 0.012, 2),
    box(0.06, 0.19, 0.045, 0.13, 0.018, 0.012, 2),
  ],
  "wall",
);
add(
  "ceiling-light",
  "Ceiling light",
  D,
  [0.5, 0.28, 0.5],
  [
    cyl(0, 0.255, 0, 0.2, 0.05, 0.2, 2),
    cyl(0, 0.19, 0, 0.025, 0.12, 0.025, 2),
    ball(0, 0.09, 0, 0.5, 0.18, 0.5, 1),
  ],
  "ceiling",
);
add("table-lamp", "Table lamp", D, [0.38, 0.55, 0.38], lamp(0.55), "surface");
add(
  "storage-shelf",
  "Storage shelf",
  D,
  [1, 1.5, 0.45],
  cabinet(1, 1.5, 0.45, true),
  "floor",
  "#aaa08a",
  "wood",
);
add(
  "shoe-rack",
  "Shoe rack",
  D,
  [0.8, 0.5, 0.3],
  [
    ...legs(0.8, 0.5, 0.3),
    box(0, 0.17, 0, 0.8, 0.035, 0.3),
    box(0, 0.45, 0, 0.8, 0.035, 0.3),
  ],
  "floor",
  "#b58c65",
  "wood",
);
// Derived canonical bounds ensure every preset's actual mesh fits the declared size.
for (const d of defs) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const p of d.parts) {
    const size = p.rotation ? [p.size[0], p.size[2], p.size[1]] : p.size;
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p.position[i] - size[i] / 2);
      max[i] = Math.max(max[i], p.position[i] + size[i] / 2);
    }
  }
  const center = min.map((v, i) => (v + max[i]) / 2);
  d.size = min.map((v, i) => max[i] - v);
  d.parts = d.parts.map((p) => ({
    ...p,
    position: p.position.map((v, i) => v - center[i]),
  }));
  Object.freeze(d.parts);
  Object.freeze(d);
}
export const FURNITURE = Object.freeze(
  Object.fromEntries(defs.map((d) => [d.id, d])),
);
export const FURNITURE_IDS = Object.freeze(defs.map((d) => d.id));
export const FURNITURE_CATEGORIES = Object.freeze([L, B, K, A, O, D]);
export function searchFurniture(query = "", category = "all") {
  const q = query.trim().toLowerCase();
  return defs.filter(
    (d) =>
      (category === "all" ||
        d.category === category ||
        (d.id === "bookshelf" && category === O)) &&
      (!q || (d.name + " " + d.category).toLowerCase().includes(q)),
  );
}
