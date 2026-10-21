import { FurnitureCatalog } from "./FurnitureCatalog";
import { ArchitecturalLibrary } from "./ArchitecturalLibrary";
import { usePrecisionSettings } from "../../scene/precisionSettings";
import { useToolsStore, type ToolsTab } from "../../workspace/toolsStore";
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

import { VoiceCommands } from "./VoiceCommands";
import { useGenerationStore } from "../../generation/generationStore";
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
  const tab = useToolsStore((s) => s.tab),
    setTab = useToolsStore((s) => s.setTab);
  const active = useSceneStore((s) => s.tool);
  const snap = useSceneStore((s) => s.snap);
  const gridStep = usePrecisionSettings((s) => s.gridStep);
  const selected = useSceneStore((s) => s.selectedId);
  const lastStructureId = useGenerationStore((s) => s.lastStructureId);
  const pending = useGenerationStore((s) => !!s.prepared);
  const hasStructure = useSceneStore(
    (s) =>
      !!lastStructureId &&
      s.objects.some((o) => o.construction?.structureId === lastStructureId),
  );
  return (
    <aside
      className={`panel tools ${compact ? "compact-tools" : ""}`}
      aria-label="Construction tools"
    >
      <div className="eyebrow">CONSTRUCTION</div>
      {!compact && (
        <nav
          className="tools-tabs"
          role="tablist"
          aria-label="Construction categories"
          onKeyDown={(e) => {
            const keys = ["build", "edit", "ai", "scene"] as ToolsTab[];
            const n = keys.indexOf(tab);
            const next =
              e.key === "ArrowRight"
                ? (n + 1) % 4
                : e.key === "ArrowLeft"
                  ? (n + 3) % 4
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? 3
                      : -1;
            if (next >= 0) {
              e.preventDefault();
              setTab(keys[next]);
              const buttons =
                e.currentTarget.querySelectorAll<HTMLButtonElement>(
                  "[role=tab]",
                );
              buttons[next].focus();
            }
          }}
        >
          {(["build", "edit", "ai", "scene"] as const).map((key) => (
            <button
              key={key}
              role="tab"
              id={`tools-tab-${key}`}
              aria-controls={`tools-pane-${key}`}
              aria-selected={tab === key}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
            >
              {key === "ai" ? "AI" : key[0].toUpperCase() + key.slice(1)}
            </button>
          ))}
        </nav>
      )}
      <section
        className="tools-pane"
        id="tools-pane-build"
        role={compact ? undefined : "tabpanel"}
        aria-labelledby={compact ? undefined : "tools-tab-build"}
        hidden={!compact && tab !== "build"}
      >
        {!compact && <h3>Shapes</h3>}
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
          <ArchitecturalLibrary />
        </div>
        <details className="furniture-library">
          <summary>Furniture & interiors</summary>
          <FurnitureCatalog />
        </details>
        {!compact && <ModelImport compact={false} section="import" />}
      </section>
      <section
        className="tools-pane"
        id="tools-pane-edit"
        role={compact ? undefined : "tabpanel"}
        aria-labelledby={compact ? undefined : "tools-tab-edit"}
        hidden={!compact && tab !== "edit"}
      >
        {!compact && <h3>Edit selection</h3>}
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
          <span>{gridStep} m</span>
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
        {!compact && (
          <details className="advanced-gesture-settings">
            <summary>Advanced gesture settings</summary>
            <AdvancedGestures />
          </details>
        )}
      </section>
      {compact ? (
        <ModelImport compact />
      ) : (
        <>
          <section
            className="tools-pane"
            id="tools-pane-ai"
            role="tabpanel"
            aria-labelledby="tools-tab-ai"
            hidden={tab !== "ai"}
          >
            <VoiceCommands />
          </section>
          <section
            className="tools-pane"
            id="tools-pane-scene"
            role="tabpanel"
            aria-labelledby="tools-tab-scene"
            hidden={tab !== "scene"}
          >
            <ModelImport compact={false} section="restore" />
            <LightingControls compact={false} />
            {hasStructure && !pending && (
              <button
                onClick={() =>
                  window.dispatchEvent(new Event("holobuild:fit-structure"))
                }
              >
                Fit structure in view
              </button>
            )}
          </section>
        </>
      )}
    </aside>
  );
}
