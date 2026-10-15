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
  return (
    <aside
      className={`panel tools ${compact ? "compact-tools" : ""}`}
      aria-label="Construction tools"
    >
      <div className="eyebrow">CONSTRUCTION</div>
      <h2>Your building blocks</h2>
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
      <div className="section-label">TRANSFORM</div>
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
      <LightingControls compact={compact} />
      <ModelImport compact={compact} />
      <div className="tip">
        <span>BUILD WITH INTENTION</span>
        <p>
          Start with a cube.
          <br />
          Make space for an idea.
        </p>
        <div className="mini-grid">◇</div>
      </div>
    </aside>
  );
}
