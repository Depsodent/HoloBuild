import { useState } from "react";
import { useSceneStore } from "../../scene/sceneStore";
import { structureInfo } from "../../scene/structures";
import { useLeftStore } from "../../workspace/leftStore";
import type { SceneObject } from "../../scene/objectTypes";
export function SceneCollection() {
  const objects = useSceneStore((s) => s.objects),
    selected = useSceneStore((s) => s.selectedId),
    group = useSceneStore((s) => s.selectedStructureId);
  const [query, setQuery] = useState("");
  const match = (o: SceneObject) =>
    `${o.name} ${o.type} ${o.construction?.role ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  const groups = [
    ...new Set(
      objects.flatMap((o) =>
        o.construction ? [o.construction.structureId] : [],
      ),
    ),
  ];
  const row = (o: SceneObject) => (
    <button
      key={o.id}
      className={selected === o.id ? "selected" : ""}
      onClick={() => {
        const s = useSceneStore.getState();
        s.setSelectionMode("component");
        s.select(o.id);
        useLeftStore.getState().setTab("inspector");
      }}
    >
      <span style={{ color: o.color }}>◇</span>
      {o.name}
      <small>{o.construction?.role ?? o.type}</small>
    </button>
  );
  return (
    <section className="panel collection-panel" aria-label="Scene Collection">
      <h2>
        Collection <small>· {objects.length}</small>
      </h2>
      <label className="field">
        Search
        <input
          aria-label="Search scene objects"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, shape or role"
        />
      </label>
      <div className="scene-list">
        {objects.filter((o) => !o.construction && match(o)).map(row)}
        {groups.map((id) => {
          const parts = objects.filter(
            (o) => o.construction?.structureId === id,
          );
          const visible = parts.filter(match);
          if (!visible.length) return null;
          const info = structureInfo(parts);
          return (
            <details key={id} open>
              <summary>
                {info.name} · {parts.length}
              </summary>
              <button
                className={group === id ? "selected" : ""}
                onClick={() => {
                  const s = useSceneStore.getState();
                  s.setSelectionMode("structure");
                  s.select(parts[0].id);
                  useLeftStore.getState().setTab("inspector");
                }}
              >
                Select whole structure
              </button>
              {visible.map(row)}
            </details>
          );
        })}
      </div>
      {!objects.some(match) && (
        <p className="muted">
          {objects.length
            ? "No matching objects."
            : "Your next idea starts here."}
        </p>
      )}
    </section>
  );
}
