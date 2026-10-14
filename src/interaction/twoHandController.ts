import type { HandsFrame } from "../vision/handRecognizer";
import type { SceneObject } from "../scene/objectTypes";
import { useSceneStore } from "../scene/sceneStore";
import { execute } from "../scene/commandManager";
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
  private armed: string | null = null;
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
    this.armed = null;
    if (!wasActive) return;
    useSceneStore.setState({ preview: null });
    useAdvancedStore.setState({ active: false, message });
    useInteractionStore.setState({ phase: "idle", hoveredId: null });
  }
  update(frame: HandsFrame) {
    const state = useAdvancedStore.getState();
    if (
      (state.mode !== "scale" && state.mode !== "rotate") ||
      useInteractionStore.getState().menuOpen
    ) {
      this.armed = null;
      if (this.active) this.cancel();
      return;
    }
    const hands = frame.hands;
    if (
      frame.ambiguous ||
      hands.length !== 2 ||
      hands.some(
        (h) =>
          !h.gesture.cursor ||
          !isOnViewport(h.gesture.cursor) ||
          h.gesture.gesture === "none",
      )
    ) {
      if (this.active || this.armed)
        this.cancel(
          "Two clear, separate hands required. Lost/ambiguous tracking cancels the preview.",
        );
      return;
    }
    const ids = hands.map((h) => h.id).join(":");
    const open = hands.every(
      (h) =>
        !h.gesture.pinchActive &&
        !h.gesture.pinchCandidate &&
        h.gesture.pinchStable,
    );
    const closed = hands.every(
      (h) => h.gesture.pinchActive && h.gesture.pinchStable,
    );
    const points = hands.map(handReference);
    if (this.session) {
      const s = this.session;
      if (
        state.mode !== s.mode ||
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
        this.armed = null;
        useAdvancedStore.setState({ active: false });
        const history = useSceneStore.getState().past.length;
        const committed =
          preview?.valid &&
          execute({
            type: "update",
            id: s.object.id,
            patch: {
              position: preview.position,
              scale: preview.scale,
              rotation: preview.rotation,
            },
          });
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
      useSceneStore.setState({
        preview: {
          id: s.object.id,
          position: result.position,
          scale,
          rotation,
          valid: result.valid,
        },
      });
      useInteractionStore.setState({
        phase: result.valid ? "dragging" : "invalid",
        hoveredId: s.object.id,
      });
      useAdvancedStore.setState({
        factor: s.factor,
        angle: (s.angle * 180) / Math.PI,
        message: result.valid
          ? `${s.mode === "scale" ? "Scale" : "Yaw rotation"}: release a pinch to confirm.`
          : "Blocked transform: collision or workspace bounds.",
      });
      return;
    }
    if (open) this.armed = ids;
    if (closed && this.armed === ids) {
      this.armed = null;
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
        factor: 1,
        angle: 0,
        message:
          state.mode === "scale"
            ? "Scaling: move hands apart or together."
            : "Yaw rotation: tilt the line between pinches.",
      });
      useInteractionStore.setState({ phase: "dragging", hoveredId: object.id });
    }
  }
}
