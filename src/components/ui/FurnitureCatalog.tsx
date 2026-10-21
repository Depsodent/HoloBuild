import { useState } from "react";
import {
  searchFurniture,
  FURNITURE_CATEGORIES,
} from "../../../shared/furnitureCatalog.mjs";
import { beginFurniture, useFurnishStore } from "../../furniture/furnishStore";
export function FurnitureCatalog() {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState("all");
  const draft = useFurnishStore((s) => s.draft?.furniture?.preset);
  const rows = searchFurniture(query, category);
  return (
    <section className="furniture-catalog" aria-label="Furniture catalog">
      <label>
        Search furniture
        <input
          type="search"
          aria-label="Search furniture"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label>
        Category
        <select
          aria-label="Furniture category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">All categories</option>
          {FURNITURE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="furniture-cards">
        {rows.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={draft === d.id}
            onClick={() => {
              if (beginFurniture(d.id)) {
                const c = document.querySelector<HTMLCanvasElement>(
                  "canvas[data-engine]",
                );
                if (c) {
                  c.tabIndex = 0;
                  c.focus();
                }
              }
            }}
            title={d.name + " · " + d.attachment + " attachment"}
          >
            <span aria-hidden="true">
              {d.category === "Bedroom"
                ? "▰"
                : d.category === "Decor and Utility"
                  ? "♧"
                  : "▤"}
            </span>
            <span>
              {d.name}
              <small>
                {d.size.map((n) => n.toFixed(2)).join(" × ")} m · {d.attachment}
              </small>
            </span>
          </button>
        ))}
      </div>
      {!rows.length && (
        <p role="status">No furniture matches. Try another category or name.</p>
      )}
    </section>
  );
}
