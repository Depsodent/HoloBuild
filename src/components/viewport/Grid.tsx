import { Grid as ConstructionGrid } from "@react-three/drei";
export function Grid() {
  return (
    <>
      <ConstructionGrid
        position={[0, -0.015, 0]}
        args={[60, 60]}
        cellSize={1}
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
