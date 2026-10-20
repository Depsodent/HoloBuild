import { useMouseGuide } from "../../scene/precisionGuide";
import { Html, Line } from "@react-three/drei";
import { useSceneStore } from "../../scene/sceneStore";
import { usePrecisionSettings } from "../../scene/precisionSettings";
import { bounds } from "../../interaction/placement";
import { structureBox, members } from "../../scene/structures";
export function PrecisionOverlay() {
  const objects = useSceneStore((s) => s.objects),
    id = useSceneStore((s) => s.selectedId),
    group = useSceneStore((s) => s.selectedStructureId),
    preview = useSceneStore((s) => s.preview),
    snap = useSceneStore((s) => s.snap),
    show = usePrecisionSettings((s) => s.measurements),
    guides = usePrecisionSettings((s) => s.guides),
    step = usePrecisionSettings((s) => s.gridStep);
  const mouse = useMouseGuide((s) => s.sample);
  const mousePreview =
    mouse?.object.id === id
      ? {
          id: mouse.object.id,
          position: mouse.object.position,
          rotation: mouse.object.rotation,
          scale: mouse.object.scale,
          valid: mouse.valid,
        }
      : null;
  const active = preview ?? mousePreview;
  const o = objects.find((v) => v.id === id);
  if (!o || (!show && !(guides && active))) return null;
  const box = group
    ? structureBox(preview?.structure?.objects ?? members(objects, group))
    : bounds(
        active?.id === o.id
          ? {
              ...o,
              position: active.position,
              scale: active.scale ?? o.scale,
              rotation: active.rotation ?? o.rotation,
            }
          : o,
      );
  const x = (box.min.x + box.max.x) / 2,
    z = (box.min.z + box.max.z) / 2;
  const color = active && !active.valid ? "#ff6c83" : "#79ffe0";
  return (
    <group raycast={() => {}}>
      {show && (
        <Line
          points={[
            [box.min.x, box.max.y + 0.15, box.min.z],
            [box.max.x, box.max.y + 0.15, box.min.z],
            [box.max.x, box.max.y + 0.15, box.max.z],
          ]}
          color={color}
          raycast={() => {}}
        />
      )}
      <Html
        position={[x, box.max.y + 0.35, z]}
        center
        style={{
          pointerEvents: "none",
          whiteSpace: "nowrap",
          background: "#0a1723e6",
          color,
          padding: "5px 8px",
          borderRadius: 4,
          fontSize: 11,
        }}
      >
        <output aria-label="Selection measurements">
          {show &&
            [
              box.max.x - box.min.x,
              box.max.y - box.min.y,
              box.max.z - box.min.z,
            ]
              .map((v) => v.toFixed(2))
              .join(" × ")}
          {show && " m"}
          {active && (
            <span>
              {show ? " · " : ""}
              {active.valid
                ? snap
                  ? "Grid " + step + " m"
                  : "Free placement"
                : "Invalid placement"}{" "}
              · X {active.position[0].toFixed(2)} / Z{" "}
              {active.position[2].toFixed(2)}
            </span>
          )}
        </output>
      </Html>
    </group>
  );
}
