import { Copy, Trash2, RotateCcw } from "lucide-react";
import { useSceneStore } from "../../scene/sceneStore";
import { execute } from "../../scene/commandManager";
import type { Vec3 } from "../../scene/objectTypes";
export function ObjectInspector() {
  const objects = useSceneStore((s) => s.objects);
  const id = useSceneStore((s) => s.selectedId);
  const object = objects.find((o) => o.id === id);
  return (
    <aside className="panel inspector">
      <div className="eyebrow">OBJECT INSPECTOR</div>
      <h2>{object ? object.name : "Nothing selected"}</h2>
      {object ? (
        <>
          <div className="object-id">
            BOX GEOMETRY <span>● SELECTED</span>
          </div>
          <label className="field">
            Name
            <input
              aria-label="Object name"
              value={object.name}
              onChange={(e) =>
                execute({
                  type: "update",
                  id: object.id,
                  patch: { name: e.target.value },
                })
              }
            />
          </label>
          {(["position", "rotation", "scale"] as const).map((property) => (
            <fieldset key={property}>
              <legend>
                {property}
                {property === "rotation" ? " · degrees" : ""}
              </legend>
              <div className="vector">
                {(["X", "Y", "Z"] as const).map((axis, index) => (
                  <label key={axis}>
                    <span className={`axis-${axis}`}>{axis}</span>
                    <input
                      aria-label={`${property} ${axis}`}
                      type="number"
                      step={property === "rotation" ? 15 : 0.5}
                      value={Number(
                        (
                          object[property][index] *
                          (property === "rotation" ? 180 / Math.PI : 1)
                        ).toFixed(2),
                      )}
                      onChange={(e) => {
                        if (e.target.value === "") return;
                        const vector = [...object[property]] as Vec3;
                        vector[index] =
                          Number(e.target.value) *
                          (property === "rotation" ? Math.PI / 180 : 1);
                        execute({
                          type: "update",
                          id: object.id,
                          patch: { [property]: vector },
                        });
                      }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="section-label">APPEARANCE</div>
          <label className="color-field">
            Surface color
            <input
              aria-label="Object color"
              type="color"
              value={object.color}
              onChange={(e) =>
                execute({
                  type: "update",
                  id: object.id,
                  patch: { color: e.target.value },
                })
              }
            />
          </label>
          <label className="field">
            Material
            <select
              value={object.material}
              onChange={(e) =>
                execute({
                  type: "update",
                  id: object.id,
                  patch: { material: e.target.value as "solid" | "glass" },
                })
              }
            >
              <option value="solid">Satin metal</option>
              <option value="glass">Holographic glass</option>
            </select>
          </label>
          <div className="object-actions">
            <button
              onClick={() => execute({ type: "duplicate", id: object.id })}
            >
              <Copy size={15} />
              Duplicate
            </button>
            <button
              title="Delete selected object"
              aria-label="Delete selected object"
              onClick={() => execute({ type: "delete", id: object.id })}
            >
              <Trash2 size={16} />
            </button>
            <button
              title="Reset transform"
              aria-label="Reset transform"
              onClick={() =>
                execute({
                  type: "update",
                  id: object.id,
                  patch: {
                    position: [0, 0.5, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1],
                  },
                })
              }
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </>
      ) : (
        <p className="muted">
          Click a cube in the viewport or the scene list to inspect it.
        </p>
      )}
      <div className="section-label scene-title">
        SCENE COLLECTION{" "}
        <span>{objects.length.toString().padStart(2, "0")}</span>
      </div>
      <div className="scene-list">
        {objects.map((o, i) => (
          <button
            className={id === o.id ? "selected" : ""}
            key={o.id}
            onClick={() => useSceneStore.getState().select(o.id)}
          >
            <span style={{ color: o.color }}>◇</span>
            {o.name}
            <small>{String(i + 1).padStart(2, "0")}</small>
          </button>
        ))}
        {!objects.length && (
          <p className="muted">Your next idea starts here.</p>
        )}
      </div>
    </aside>
  );
}
