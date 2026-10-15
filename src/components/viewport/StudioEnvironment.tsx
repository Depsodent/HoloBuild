import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useLightingStore } from "../../scene/lightingStore";
// Procedural reflection studio, generated locally once. No HDR download or
// visible background replacement; the construction grid/theme remain intact.
export function StudioEnvironment() {
  const { gl, scene } = useThree();
  const intensity = useLightingStore((s) => s.lighting.environment);
  useEffect(() => {
    scene.environmentIntensity = intensity;
  }, [scene, intensity]);
  useEffect(() => {
    const previous = scene.environment;
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    scene.environment = target.texture;
    room.dispose();
    generator.dispose();
    return () => {
      scene.environment = previous;
      target.dispose();
    };
  }, [gl, scene]);
  return null;
}
