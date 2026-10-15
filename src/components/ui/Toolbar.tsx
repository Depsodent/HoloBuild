import { SHAPES } from "../../scene/objectFactory";
import {
  Box,
  Circle,
  Cylinder,
  Triangle,
  RectangleHorizontal,
  Grid2X2,
  MousePointer2,
  Move3d,
  Rotate3d,
  Scaling,
  Plus,
} from "lucide-react";
import { useSceneStore } from "../../scene/sceneStore";
import { execute } from "../../scene/commandManager";
import type { Tool, ObjectType } from "../../scene/objectTypes";
import { LightingControls } from "./LightingControls";
import { ModelImport } from "./ModelImport";
import { AdvancedGestures } from "./AdvancedGestures";
import { Accordion } from "./Accordion";
const shapeIcons = {
  cube: Box,
  sphere: Circle,
  cylinder: Cylinder,
  cone: Triangle,
  wall: RectangleHorizontal,
  floor: Grid2X2,
};
const tools = [
  ["select", "Select", MousePointer2, "V"],
  ["translate", "Move", Move3d, "G"],
  ["rotate", "Rotate", Rotate3d, "R"],
  ["scale", "Scale", Scaling, "S"],
] as const;
export function Toolbar({ compact = false }: { compact?: boolean }) {
  const active = useSceneStore((s) => s.tool);
  const snap = useSceneStore((s) => s.snap);
  const selected = useSceneStore((s) => s.selectedId);
  return (
    <aside
      className={`panel tools ${compact ? "compact-tools" : ""}`}
      aria-label="Construction tools"
    >
      <div className="eyebrow">CONSTRUCTION</div>
      <h2>Your building blocks</h2>
      <Accordion id="tools.shapes" title="Shapes" forceOpen={compact}>
        <div className="shape-palette" aria-label="Construction shapes">
          {(Object.entries(SHAPES) as [ObjectType, typeof SHAPES.cube][]).map(
            ([type, shape]) => (
              <button
                key={type}
                className="shape"
                title={`Create ${shape.name}`}
                aria-label={`${shape.name} ${shape.description}`}
                onClick={() => execute({ type: "create", objectType: type })}
              >
                {(() => {
                  const Icon = shapeIcons[type];
                  return <Icon size={22} />;
                })()}
                <span>
                  {shape.name}
                  <small>{shape.description}</small>
                </span>
                <Plus size={14} />
              </button>
            ),
          )}
        </div>
      </Accordion>
      <Accordion
        id="tools.transform"
        title="Transform Tools"
        forceOpen={compact}
      >
        <div className="tool-list">
          {tools.map(([id, label, Icon, key]) => (
            <button
              key={id}
              className={active === id ? "active" : ""}
              onClick={() => useSceneStore.getState().setTool(id as Tool)}
              title={`${label} (${key})`}
              aria-label={`${label} ${key}`}
            >
              <Icon size={18} />
              <span className="tool-name">{label}</span>
              <kbd>{key}</kbd>
            </button>
          ))}
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            aria-label="Snap to grid"
            checked={snap}
            onChange={(e) => useSceneStore.setState({ snap: e.target.checked })}
          />
          <span className="snap-description">Snap to grid</span>{" "}
          <span>0.5 m</span>
        </label>
        {!compact && (
          <div className="object-actions">
            <button
              aria-label="Duplicate selected object"
              disabled={!selected}
              onClick={() =>
                selected && execute({ type: "duplicate", id: selected })
              }
            >
              Duplicate
            </button>
            <button
              aria-label="Delete object from toolbar"
              disabled={!selected}
              onClick={() =>
                selected && execute({ type: "delete", id: selected })
              }
            >
              Delete
            </button>
          </div>
        )}
      </Accordion>
      {compact ? (
        <ModelImport compact />
      ) : (
        <>
          <Accordion id="tools.gestures" title="Gesture Controls">
            <AdvancedGestures />
          </Accordion>
          <Accordion id="tools.models" title="Imported Models">
            <ModelImport compact={false} />
          </Accordion>
          <Accordion id="tools.lighting" title="Scene & Lighting">
            <LightingControls compact={false} />
          </Accordion>
        </>
      )}
    </aside>
  );
}
