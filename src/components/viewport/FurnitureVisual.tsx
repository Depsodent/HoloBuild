import { useMemo } from "react";
import {
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  ConeGeometry,
  Matrix4,
  Quaternion,
  Euler,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FURNITURE } from "../../../shared/furnitureCatalog.mjs";
import type { SceneObject } from "../../scene/objectTypes";
import { SurfaceMaterial } from "./SurfaceMaterial";
import { usePreviewColor } from "../../scene/colorPreview";
const cache = new Map<string, { tone: number; geometry: BufferGeometry }[]>();
export function furnitureGeometry(id: string) {
  let found = cache.get(id);
  if (found) return found;
  const groups = new Map<number, BufferGeometry[]>();
  for (const p of FURNITURE[id].parts) {
    const g =
      p.shape === "box"
        ? new BoxGeometry(1, 1, 1)
        : p.shape === "sphere"
          ? new SphereGeometry(0.5, 10, 7)
          : p.shape === "cone"
            ? new ConeGeometry(0.5, 1, 12)
            : new CylinderGeometry(0.5, 0.5, 1, 12);
    g.deleteAttribute("uv");
    g.applyMatrix4(
      new Matrix4().compose(
        new Vector3(...p.position),
        new Quaternion().setFromEuler(new Euler(...(p.rotation ?? [0, 0, 0]))),
        new Vector3(...p.size),
      ),
    );
    groups.set(p.tone, [...(groups.get(p.tone) ?? []), g]);
  }
  found = [...groups].map(([tone, parts]) => {
    const geometry = mergeGeometries(parts)!;
    parts.forEach((p) => p.dispose());
    return { tone, geometry };
  });
  cache.set(id, found);
  return found;
}
// Shared catalog buffers are bounded by preset count and survive instance deletion.
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    cache.forEach((rows) => rows.forEach((p) => p.geometry.dispose()));
    cache.clear();
  });
export function FurnitureVisual({
  object,
  ghost,
  highlight = false,
  grabbed = false,
}: {
  object: SceneObject;
  ghost?: boolean;
  highlight?: boolean;
  grabbed?: boolean;
}) {
  const color = usePreviewColor(object.id) ?? object.color;
  const rows = useMemo(
    () => furnitureGeometry(object.furniture!.preset),
    [object.furniture],
  );
  return (
    <group userData={{ furniturePreset: object.furniture!.preset }}>
      {rows.map(({ tone, geometry }) => (
        <mesh
          key={tone}
          geometry={geometry}
          dispose={null}
          castShadow={!ghost}
          receiveShadow
          raycast={ghost ? () => {} : undefined}
        >
          {ghost ? (
            <meshBasicMaterial
              color={object.color}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          ) : (
            <SurfaceMaterial
              manualDispose
              object={{
                ...object,
                id: object.id + ":" + tone,
                color:
                  tone === 0
                    ? color
                    : tone === 1
                      ? "#e5ddd1"
                      : tone === 2
                        ? "#283844"
                        : "#72aabb",
                surface: object.surface,
              }}
              grabbed={grabbed}
              highlight={highlight}
            />
          )}
        </mesh>
      ))}
    </group>
  );
}
