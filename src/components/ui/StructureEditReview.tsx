import {
  useEditStore,
  confirmEdit,
  cancelEdit,
} from "../../generation/editStore";
import { useSceneStore } from "../../scene/sceneStore";
import { updateGeneration } from "../../generation/generationStore";
export function StructureEditReview() {
  const s = useEditStore(),
    objects = useSceneStore((s) => s.objects),
    selected = useSceneStore((s) => s.selectedId),
    preview = useSceneStore((s) => s.preview);
  const mode = useSceneStore((s) => s.selectionMode),
    group = useSceneStore((s) => s.selectedStructureId);
  if (s.status === "idle") return null;
  return (
    <div aria-label="Structure edit result">
      <p role="status">{s.message}</p>
      {s.source && (
        <p className="muted" aria-label="Edit planner source">
          {s.source}
        </p>
      )}
      {s.prepared && (
        <section aria-label="Structure modification preview">
          <p>
            {s.prepared.affected.length} affected components · scene unchanged
          </p>
          <details>
            <summary>Affected components</summary>
            <ul className="component-list">
              {s.prepared.affected.map((id) => (
                <li key={id}>
                  {s.prepared!.result.objects.find((o) => o.id === id)?.name ??
                    objects.find((o) => o.id === id)?.name ??
                    id}
                </li>
              ))}
            </ul>
          </details>
          <div className="object-actions">
            <button
              disabled={
                !!preview ||
                objects !== s.prepared.base ||
                selected !== s.prepared.selected ||
                mode !== s.prepared.selectionMode ||
                group !== s.prepared.selectedGroup
              }
              onClick={() => {
                if (confirmEdit()) updateGeneration({ prompt: "" });
              }}
            >
              Confirm structure edit
            </button>
            <button
              onClick={() => {
                cancelEdit();
                updateGeneration({ prompt: "" });
              }}
            >
              Cancel structure edit
            </button>
          </div>
        </section>
      )}
      {s.status === "planning" && (
        <button onClick={cancelEdit}>Cancel structure edit</button>
      )}
    </div>
  );
}
