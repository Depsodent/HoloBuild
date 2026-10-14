import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useSceneStore } from "../../scene/sceneStore";
import { Grid } from "./Grid";
import { SceneLights } from "./SceneLights";
import { StudioEnvironment } from "./StudioEnvironment";
import { CameraController } from "./CameraController";
import { BuildingObject } from "./BuildingObject";
import { ViewportBoundary } from "./ViewportBoundary";
import { GestureInteraction, PlacementPreview } from "./GestureInteraction";
function Metrics() {
  const timer = useRef({ elapsed: 0, frames: 0 });
  useFrame(({ gl }, delta) => {
    timer.current.elapsed += delta;
    timer.current.frames++;
    if (timer.current.elapsed >= 1) {
      useSceneStore.setState({
        fps: Math.round(timer.current.frames / timer.current.elapsed),
        drawCalls: gl.info.render.calls,
      });
      timer.current = { elapsed: 0, frames: 0 };
    }
  });
  return null;
}
export function Scene() {
  const objects = useSceneStore((s) => s.objects);
  return (
    <ViewportBoundary>
      <Canvas
        fallback={
          <div className="viewport-error">
            WebGL is unavailable. Enable hardware acceleration and reload.
          </div>
        }
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [7, 6, 9], fov: 45 }}
        onPointerMissed={() => useSceneStore.getState().select(null)}
        gl={{ antialias: true }}
      >
        <color attach="background" args={["#0a121e"]} />
        <fog attach="fog" args={["#0a121e", 25, 65]} />
        <SceneLights />
        <StudioEnvironment />
        <Grid />
        <CameraController />
        <Metrics />
        <GestureInteraction />
        <PlacementPreview />
        {objects.map((object) => (
          <BuildingObject key={object.id} object={object} />
        ))}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.03, 0]}
          receiveShadow
        >
          <planeGeometry args={[200, 200]} />
          <meshLambertMaterial
            color="#0c1723"
            polygonOffset
            polygonOffsetFactor={1}
          />
        </mesh>
      </Canvas>
    </ViewportBoundary>
  );
}
