import { usePrecisionSettings } from "../../scene/precisionSettings";
import { Grid as ConstructionGrid } from "@react-three/drei";
export function Grid() {
  const step = usePrecisionSettings((s) => s.gridStep);
  return (
    <>
      <ConstructionGrid
        position={[0, -0.015, 0]}
        args={[60, 60]}
        cellSize={step}
        cellThickness={0.6}
        cellColor="#203e50"
        sectionSize={5}
        sectionColor="#32747e"
        sectionThickness={1}
        fadeDistance={55}
        infiniteGrid
      />
      <axesHelper args={[2]} />
    </>
  );
}
