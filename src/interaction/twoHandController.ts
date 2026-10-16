import type { HandsFrame } from "../vision/handRecognizer";
import type { SceneObject } from "../scene/objectTypes";
import { useSceneStore } from "../scene/sceneStore";
import { groupPreview, commitPlacement } from "./structureInteraction";
import { useInteractionStore } from "./interactionStore";
import { useAdvancedStore } from "./advancedStore";
import { isOnViewport } from "./coordinateMapping";
import {
  boundedFactor,
  handDistance,
  handReference,
  transformedPlacement,
  handAngle,
  angleDelta,
  yawRotation,
} from "./twoHandMath";
export class TwoHandController {
  private ready = new Map<number, number>();
  private selectionKey = "";
  private lastFrame = 0;
  private lastUi = 0;
  private session: {
    ids: string;
    object: SceneObject;
    distance: number;
    factor: number;
    mode: "scale" | "rotate";
    lastAngle: number;
    unwrapped: number;
    angle: number;
    sensitivity: number;
    time: number;
    points: { x: number; y: number }[];
  } | null = null;
  get active() {
    return this.session !== null;
  }
  cancel(
    message = "Advanced operation cancelled. Open both pinches to try again.",
  ) {
    const wasActive = this.active;
    this.session = null;
    this.ready.clear();
    this.selectionKey = "";
    if (!wasActive) return;
    useSceneStore.setState({ preview: null });
    useAdvancedStore.setState({ active: false, readyHands: 0, message });
    useInteractionStore.setState({ phase: "idle", hoveredId: null });
  }
  update(frame: HandsFrame) {
    const state = useAdvancedStore.getState();
    if (
      (state.mode !== "scale" && state.mode !== "rotate") ||
      useInteractionStore.getState().menuOpen
    ) {
      this.ready.clear();
      if (this.active) this.cancel();
      return;
    }
    const selected = useSceneStore
      .getState()
      .objects.find((o) => o.id === useSceneStore.getState().selectedId);
    const key = `${state.mode}:${selected?.id ?? ""}`;
    if (
      !this.active &&
      (key !== this.selectionKey || frame.timestamp - this.lastFrame > 250)
    )
      this.ready.clear();
    this.selectionKey = key;
    this.lastFrame = frame.timestamp;
    const hands = [...frame.hands].sort((a, b) => a.id - b.id);
    const status = (message: string) => {
      const current = useAdvancedStore.getState();
      if (current.message !== message || current.readyHands !== this.ready.size)
        useAdvancedStore.setState({ message, readyHands: this.ready.size });
    };
    const unstable = hands.filter(
      (h) =>
        !h.gesture.cursor ||
        !isOnViewport(h.gesture.cursor) ||
        h.gesture.gesture === "none",
    );
    if (
      frame.ambiguous ||
      (this.active && (hands.length !== 2 || unstable.length > 0))
    ) {
      if (this.active)
        this.cancel(
          "Two clear, separate hands required. Lost/ambiguous tracking cancels the preview.",
        );
      this.ready.clear();
      status("Tracking unclear. Keep both hands visible and separated.");
      return;
    }
    if (!this.active && unstable.length) {
      // A newly detected hand spends several frames stabilizing. It must not
      // erase the first hand's already-observed open pinch while it arrives.
      for (const [id, time] of this.ready)
        if (!hands.some((h) => h.id === id) || frame.timestamp - time > 4000)
          this.ready.delete(id);
      for (const h of unstable) this.ready.delete(h.id);
      status(
        selected
          ? `Object selected: ${selected.name} · Waiting for second hand to stabilize.`
          : "Select an object once with one-hand pinch or mouse.",
      );
      return;
    }
    const ids = hands.map((h) => h.id).join(":");
    const closed = hands.every(
      (h) => h.gesture.pinchActive && h.gesture.pinchStable,
    );
    const points = hands.map(handReference);
    if (this.session) {
      const s = this.session;
      if (
        state.mode !== s.mode ||
        selected?.id !== s.object.id ||
        ids !== s.ids ||
        frame.timestamp - s.time > 250 ||
        points.some(
          (p, i) => Math.hypot(p.x - s.points[i].x, p.y - s.points[i].y) > 0.25,
        )
      ) {
        this.cancel(
          "Hand identity changed or tracking jumped. Transform cancelled.",
        );
        return;
      }
      const elapsed = frame.timestamp - s.time;
      s.time = frame.timestamp;
      s.points = points;
      if (!hands.every((h) => h.gesture.pinchStable)) return;
      if (!closed) {
        const preview = useSceneStore.getState().preview;
        this.session = null;
        this.ready.clear();
        useAdvancedStore.setState({ active: false, readyHands: 0 });
        const history = useSceneStore.getState().past.length;
        const committed = preview?.valid && commitPlacement(preview);
        useSceneStore.setState({ preview: null });
        useInteractionStore.setState({ phase: "idle", hoveredId: null });
        useAdvancedStore.setState({
          message: committed
            ? useSceneStore.getState().past.length === history
              ? "Transform unchanged. No undo entry."
              : "Transform placed. One Undo restores it."
            : "Invalid transform cancelled.",
        });
        return;
      }
      const alpha = 1 - Math.exp(-Math.max(0, elapsed) / 85);
      const rawAngle = handAngle(hands[0], hands[1], frame.aspectRatio);
      if (
        s.mode === "rotate" &&
        handDistance(hands[0], hands[1], frame.aspectRatio) < 0.08
      ) {
        this.cancel("Separate pinches for stable rotation.");
        return;
      }
      s.unwrapped += angleDelta(rawAngle, s.lastAngle);
      s.lastAngle = rawAngle;
      s.angle += (s.unwrapped * s.sensitivity - s.angle) * alpha;
      const target = boundedFactor(
        s.object.scale,
        handDistance(hands[0], hands[1], frame.aspectRatio) / s.distance,
      );
      // Landmark smoothing plus bounded per-frame interpolation avoids jumps.
      s.factor += (target - s.factor) * alpha;
      const scale = s.object.scale.map(
        (v) => v * (s.mode === "scale" ? s.factor : 1),
      ) as SceneObject["scale"];
      const rotation =
        s.mode === "rotate"
          ? yawRotation(s.object.rotation, s.angle)
          : ([...s.object.rotation] as SceneObject["rotation"]);
      const result = transformedPlacement(
        s.object,
        scale,
        rotation,
        useSceneStore.getState().objects,
        useSceneStore.getState().snap,
      );
      const grouped = groupPreview(
        s.object.id,
        s.mode === "scale"
          ? { type: "scale", factors: [s.factor, s.factor, s.factor] }
          : { type: "rotate", angle: s.angle },
      );
      useSceneStore.setState({
        preview: grouped ?? {
          id: s.object.id,
          position: result.position,
          scale,
          rotation,
          valid: result.valid,
        },
      });
      useInteractionStore.setState({
        phase: (grouped?.valid ?? result.valid) ? "dragging" : "invalid",
        hoveredId: s.object.id,
      });
      const message =
        (grouped?.valid ?? result.valid)
          ? `${s.mode === "scale" ? "Scaling active" : "Rotating active"} · Release to confirm.`
          : "Blocked transform: collision or workspace bounds.";
      if (
        frame.timestamp - this.lastUi >= 100 ||
        message !== useAdvancedStore.getState().message
      ) {
        this.lastUi = frame.timestamp;
        useAdvancedStore.setState({
          factor: s.factor,
          angle: (s.angle * 180) / Math.PI,
          message,
        });
      }
      return;
    }
    if (!selected) {
      this.ready.clear();
      status(
        "Select an object once: point and pinch with one hand, or click it.",
      );
      return;
    }
    // Each identity may open independently. The first pinch can wait up to four
    // seconds for the other hand; capture the baseline only when BOTH are closed.
    for (const [id, time] of this.ready)
      if (!hands.some((h) => h.id === id) || frame.timestamp - time > 4000)
        this.ready.delete(id);
    for (const h of hands)
      if (
        !h.gesture.pinchActive &&
        !h.gesture.pinchCandidate &&
        h.gesture.pinchStable
      )
        this.ready.set(h.id, frame.timestamp);
    if (hands.length < 2) {
      status(
        `Object selected: ${selected.name} · Waiting for ${hands.length ? "second hand" : "hands"}.`,
      );
      return;
    }
    const prepared = hands.every((h) => this.ready.has(h.id));
    status(
      prepared
        ? `Object selected: ${selected.name} · Pinch both hands (up to 4 s apart).`
        : "Open thumb and index on each hand once, then pinch both.",
    );
    if (closed && prepared) {
      this.ready.clear();
      const scene = useSceneStore.getState(),
        object = scene.objects.find((o) => o.id === scene.selectedId);
      const distance = handDistance(hands[0], hands[1], frame.aspectRatio);
      if (!object || distance < 0.08) {
        useAdvancedStore.setState({
          message: "Select an object and separate hands before pinching both.",
        });
        return;
      }
      scene.setTool("select");
      this.session = {
        ids,
        object: structuredClone(object),
        distance,
        factor: 1,
        mode: state.mode,
        lastAngle: handAngle(hands[0], hands[1], frame.aspectRatio),
        unwrapped: 0,
        angle: 0,
        sensitivity: state.rotationSensitivity,
        time: frame.timestamp,
        points,
      };
      useSceneStore.setState({
        preview: {
          id: object.id,
          position: [...object.position],
          scale: [...object.scale],
          valid: true,
        },
      });
      useAdvancedStore.setState({
        active: true,
        readyHands: 2,
        factor: 1,
        angle: 0,
        message:
          state.mode === "scale"
            ? "Scaling active · Move hands apart/together. Release to confirm."
            : "Rotating active · Tilt the hand line. Release to confirm.",
      });
      useInteractionStore.setState({ phase: "dragging", hoveredId: object.id });
    }
  }
}
