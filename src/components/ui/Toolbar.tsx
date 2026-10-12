import {
  Box,
  MousePointer2,
  Move3d,
  Rotate3d,
  Scaling,
  Plus,
} from "lucide-react";
import { useSceneStore } from "../../scene/sceneStore";
import { execute } from "../../scene/commandManager";
import type { Tool } from "../../scene/objectTypes";
const tools = [
  ["select", "Select", MousePointer2, "V"],
  ["translate", "Move", Move3d, "G"],
  ["rotate", "Rotate", Rotate3d, "R"],
  ["scale", "Scale", Scaling, "S"],
] as const;
export function Toolbar() {
  const active = useSceneStore((s) => s.tool);
  const snap = useSceneStore((s) => s.snap);
  return (
    <aside className="panel tools">
      <div className="eyebrow">CONSTRUCTION</div>
      <h2>Your building blocks</h2>
      <button className="shape" onClick={() => execute({ type: "create" })}>
        <Box size={38} />
        <span>
          Cube<small>1 × 1 × 1 m</small>
        </span>
        <Plus size={17} />
      </button>
      <div className="section-label">TRANSFORM</div>
      <div className="tool-list">
        {tools.map(([id, label, Icon, key]) => (
          <button
            key={id}
            className={active === id ? "active" : ""}
            onClick={() => useSceneStore.getState().setTool(id as Tool)}
            title={`${label} (${key})`}
          >
            <Icon size={18} />
            {label}
            <kbd>{key}</kbd>
          </button>
        ))}
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={snap}
          onChange={(e) => useSceneStore.setState({ snap: e.target.checked })}
        />
        Snap to grid <span>0.5 m</span>
      </label>
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
