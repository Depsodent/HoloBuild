import { OrbitControls } from "@react-three/drei";
import { useInteractionStore } from "../../interaction/interactionStore";
export function CameraController() {
  const dragging = useInteractionStore(
    (s) => s.phase === "dragging" || s.phase === "invalid",
  );
  return (
    <OrbitControls
      makeDefault
      enabled={!dragging}
      minDistance={3}
      maxDistance={45}
      maxPolarAngle={Math.PI / 2 - 0.03}
      target={[0, 0.5, 0]}
    />
  );
}
