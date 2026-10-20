import { useState } from "react";
import type { SceneObject } from "../../scene/objectTypes";
import { requestEdit } from "../../generation/editStore";
import { openTools } from "../../workspace/toolsStore";
export function NativeAssemblyInspector({ object }: { object: SceneObject }) {
  const info = object.construction!.structure!;
  const [stair, setStair] = useState(info.standaloneStairs),
    [wall, setWall] = useState(info.nativeWall);
  const opening = wall?.openings.find(
    (d) => d.id === object.construction?.opening,
  );
  const preview = async (remove = false) => {
    await requestEdit(
      "Update native assembly",
      { mode: "offline" },
      {
        type: "design",
        ...(stair
          ? { standaloneStairs: stair }
          : {
              nativeWall: remove
                ? {
                    ...wall!,
                    openings: wall!.openings.filter(
                      (d) => d.id !== opening?.id,
                    ),
                  }
                : wall,
            }),
      },
      true,
    );
    openTools("ai");
  };
  return (
    <aside aria-label="Native assembly parameters">
      <h3>{stair ? "Standalone Stairs" : "Editable wall"}</h3>
      <p className="muted">
        {stair
          ? "Freestanding flight; no automatic floor opening. Rise and run are in metres."
          : "Real segmented wall opening; panes stay attached to their wall."}
      </p>
      <div className="precision-grid">
        {stair &&
          (["width", "height", "run", "steps"] as const).map((key) => (
            <label key={key}>
              {key}
              <input
                aria-label={"Standalone stair " + key}
                type="number"
                step={key === "steps" ? 1 : 0.05}
                value={stair[key]}
                onChange={(e) =>
                  setStair({ ...stair, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        {opening &&
          (["width", "height", "offset", "bottom"] as const).map((key) => (
            <label key={key}>
              {key}
              <input
                aria-label={"Wall opening " + key}
                type="number"
                step=".05"
                value={opening[key]}
                onChange={(e) =>
                  setWall({
                    ...wall!,
                    openings: wall!.openings.map((d) =>
                      d.id === opening.id
                        ? { ...d, [key]: Number(e.target.value) }
                        : d,
                    ),
                  })
                }
              />
            </label>
          ))}
      </div>
      {(stair || opening) && (
        <button onClick={() => void preview()}>
          Preview native parameters
        </button>
      )}
      {opening && (
        <button onClick={() => void preview(true)}>Remove wall opening</button>
      )}
      {wall && !opening && (
        <p className="muted">AI Edit: Add a window to the selected wall.</p>
      )}
    </aside>
  );
}
