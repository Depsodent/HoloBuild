import type { ObjectType } from "../../scene/objectTypes";
import { SHAPES } from "../../scene/objectFactory";
// Shared by persistent meshes and gesture previews, so picking and feedback
// always use the same primitive and dimensions.
export function ObjectGeometry({
  type,
  size,
}: {
  type: ObjectType | "model";
  size?: [number, number, number];
}) {
  if (type === "model") return <boxGeometry args={size ?? [1, 1, 1]} />;
  if (type === "sphere") return <sphereGeometry args={[0.5, 32, 20]} />;
  if (type === "cylinder") return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
  if (type === "cone") return <coneGeometry args={[0.5, 1, 32]} />;
  return <boxGeometry args={SHAPES[type].size} />;
}
