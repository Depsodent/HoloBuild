import { OrbitControls } from "@react-three/drei";
export function CameraController() {
  return (
    <OrbitControls
      makeDefault
      minDistance={3}
      maxDistance={45}
      maxPolarAngle={Math.PI / 2 - 0.03}
      target={[0, 0.5, 0]}
    />
  );
}
