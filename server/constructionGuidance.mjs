// Few-shot geometry guidance only. Never substitute or repair a model result.
const part = (id, role, type, position, dimensions, rotation = [0, 0, 0]) => ({
  id,
  name: id,
  role,
  type,
  position,
  dimensions,
  rotation,
  material: role === "wall" ? "brick" : "concrete",
  color: "#d9e5ed",
});
export const referenceHouse = {
  version: 1,
  name: "Small House",
  units: "meters",
  objects: [
    part("ground", "floor", "floor", [0, 0.1, 0], [4, 0.2, 4]),
    part("north", "wall", "wall", [0, 1.6, -1.9], [4, 2.8, 0.2]),
    part("south", "wall", "wall", [0, 1.6, 1.9], [4, 2.8, 0.2]),
    part(
      "east",
      "wall",
      "wall",
      [1.9, 1.6, 0],
      [3.6, 2.8, 0.2],
      [0, Math.PI / 2, 0],
    ),
    part(
      "west",
      "wall",
      "wall",
      [-1.9, 1.6, 0],
      [3.6, 2.8, 0.2],
      [0, Math.PI / 2, 0],
    ),
    part("roof", "roof", "floor", [0, 3.1, 0], [4, 0.2, 4]),
  ],
  contacts: [],
  warnings: [],
};
export const constructionGuidance =
  "Non-overlap is essential: dimensions are LOCAL axes before rotation. A yaw of pi/2 turns local X length into world Z length; do not swap dimensions again. Wall bottom = floor center Y + floor thickness/2. Roof bottom = wall center Y + wall height/2. At rectangular corners, one opposite wall pair spans full width; the perpendicular pair must be shortened by BOTH end-wall thicknesses to meet their inner faces without overlapping. Contacts never authorize a full wall corner intersection. Here is a validated six-part 4m by4m house with four walls and a FLAT roof, no doors/windows. Use it as a geometric example; adapt only to explicit requirements, retaining exact touching faces. Do not invent openings or extra detail for a simple request. Example: " +
  JSON.stringify(referenceHouse);
