import { Box, Undo2, X, Move3d, Rotate3d, Scaling } from "lucide-react";
import { useInteractionStore } from "../../interaction/interactionStore";
import { runMenuAction } from "../../interaction/intentMapper";
export function GestureMenu() {
  const open = useInteractionStore((s) => s.menuOpen);
  if (!open) return null;
  return (
    <section className="gesture-menu" aria-label="Gesture tool menu">
      <div className="eyebrow">TOOLS AT YOUR FINGERTIPS</div>
      <h2>Point. Pinch. Build.</h2>
      <p>Point at a card, then pinch to choose.</p>
      <div>
        <button
          data-gesture-action="create"
          onClick={() => runMenuAction("create")}
        >
          <Box size={24} />
          Create cube
        </button>
        <button
          data-gesture-action="undo"
          onClick={() => runMenuAction("undo")}
        >
          <Undo2 size={24} />
          Undo
        </button>
        <button
          data-gesture-action="move"
          onClick={() => runMenuAction("move")}
        >
          <Move3d size={24} />
          Move
        </button>
        <button
          data-gesture-action="scale"
          onClick={() => runMenuAction("scale")}
        >
          <Scaling size={24} />
          Scale
        </button>
        <button
          data-gesture-action="rotate"
          onClick={() => runMenuAction("rotate")}
        >
          <Rotate3d size={24} />
          Rotate
        </button>
        <button
          data-gesture-action="navigate"
          onClick={() => runMenuAction("navigate")}
        >
          <Move3d size={24} />
          Pan view
        </button>
        <button
          data-gesture-action="close"
          onClick={() => runMenuAction("close")}
        >
          <X size={24} />
          Close
        </button>
      </div>
    </section>
  );
}
