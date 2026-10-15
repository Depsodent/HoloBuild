import { useLightingStore } from "../../scene/lightingStore";
export function SceneLights() {
  const light = useLightingStore((s) => s.lighting);
  return (
    <>
      <ambientLight intensity={light.ambient} />
      <directionalLight
        position={[4, 8, 6]}
        intensity={light.key}
        castShadow={light.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
      />
      <pointLight
        position={[-5, 3, -3]}
        intensity={light.fill}
        color="#a5b9ff"
      />
    </>
  );
}
