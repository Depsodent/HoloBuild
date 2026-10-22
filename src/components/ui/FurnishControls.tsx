import { FURNITURE } from "../../../shared/furnitureCatalog.mjs";
import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useViewStore } from "../../exploration/viewStore";
import { useSceneStore } from "../../scene/sceneStore";
import { executeFurnishing } from "../../scene/commandManager";
import {
  useFurnishStore,
  openFurnish,
  closeFurnish,
  cancelFurniture,
  confirmFurniture,
  rotateFurniture,
  beginFurniture,
} from "../../furniture/furnishStore";
import { FurnitureCatalog } from "./FurnitureCatalog";
export function FurnishControls() {
  const guide = useViewStore((s) => s.guide);
  const walking = useViewStore((s) => s.walking),
    active = useViewStore((s) => s.furnishing);
  const s = useFurnishStore(
    useShallow(({ draft, valid, reason, catalog, selected }) => ({
      draft,
      valid,
      reason,
      catalog,
      selected,
    })),
  );
  const selected = useSceneStore((state) =>
    state.objects.find((o) => o.id === s.selected && o.furniture),
  );
  useEffect(() => {
    if (!active && walking) cancelFurniture();
    if (!walking) closeFurnish(false);
  }, [walking, active]);
  useEffect(() => {
    const stop = () => cancelFurniture();
    window.addEventListener("holobuild:exploration-enter", stop);
    return () =>
      window.removeEventListener("holobuild:exploration-enter", stop);
  }, []);
  if (!walking && !s.draft) return null;
  if (walking && !active)
    return (
      <aside className="furnish-entry" aria-label="Furnishing">
        <button onClick={openFurnish}>Furnish</button>
      </aside>
    );
  return (
    <aside
      hidden={walking && guide}
      className="furnish-panel"
      aria-label="Furnish workspace"
    >
      <header>
        <strong>{s.draft?.name ?? selected?.name ?? "Furnish"}</strong>
        <button onClick={() => (walking ? closeFurnish() : cancelFurniture())}>
          {walking ? "Done furnishing" : "Cancel placement"}
        </button>
      </header>
      {s.catalog && <FurnitureCatalog />}
      {s.draft ? (
        <>
          <p>
            {walking
              ? "Aim at a support · arrows rotate · click scene or Enter places · E closes · Escape exits."
              : "Aim at a support · Q/E rotate · click scene or Enter places · Escape cancels."}
          </p>
          <div className="furnish-actions">
            <button
              disabled={
                !!s.draft &&
                FURNITURE[s.draft.furniture!.preset].attachment === "wall"
              }
              onClick={() => rotateFurniture(-Math.PI / 12)}
            >
              Rotate left
            </button>
            <button
              disabled={
                !!s.draft &&
                FURNITURE[s.draft.furniture!.preset].attachment === "wall"
              }
              onClick={() => rotateFurniture(Math.PI / 12)}
            >
              Rotate right
            </button>
            <button disabled={!s.valid} onClick={confirmFurniture}>
              Place furniture
            </button>
            <button onClick={cancelFurniture}>Cancel preview</button>
          </div>
        </>
      ) : (
        <>
          <button
            onClick={() => useFurnishStore.setState({ catalog: !s.catalog })}
          >
            {s.catalog ? "Hide catalog" : "Browse furniture"}
          </button>
          {selected && (
            <div className="furnish-actions">
              <button
                onClick={() =>
                  beginFurniture(selected.furniture!.preset, selected)
                }
              >
                Reposition selected furniture
              </button>
              <button
                onClick={() => {
                  if (
                    executeFurnishing(
                      { type: "delete", id: selected.id },
                      useSceneStore.getState().objects,
                    )
                  )
                    useFurnishStore.setState({
                      selected: null,
                      reason: "Furniture removed. Exit Walkthrough to Undo.",
                    });
                }}
              >
                Remove selected furniture
              </button>
            </div>
          )}
          <p>
            Click furniture to select it. Normal walking remains read-only
            outside Furnish.
          </p>
        </>
      )}
      <p
        role="status"
        className={
          s.draft
            ? s.valid
              ? "placement-valid"
              : "placement-invalid"
            : undefined
        }
      >
        {s.reason}
      </p>
    </aside>
  );
}
