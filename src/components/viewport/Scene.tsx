import { PrecisionOverlay } from "./PrecisionOverlay";
import { recordGraphics } from "../../vision/graphicsInfo";
import { useLightingStore } from "../../scene/lightingStore";
import { StructureControls } from "./StructureControls";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useRef, useEffect, memo } from "react";
import { useSceneStore } from "../../scene/sceneStore";
import { Grid } from "./Grid";
import { SceneLights } from "./SceneLights";
import { StudioEnvironment } from "./StudioEnvironment";
import { CameraController } from "./CameraController";
import { BuildingObject } from "./BuildingObject";
import { ViewportBoundary } from "./ViewportBoundary";
import { GestureInteraction, PlacementPreview } from "./GestureInteraction";
import { SurfaceResources } from "./SurfaceMaterial";
import { performanceMetrics } from "../../vision/performanceStore";
import { GenerationPreview } from "./GenerationPreview";
function ShadowCache() {
  const gl = useThree((s) => s.gl),
    objects = useSceneStore((s) => s.objects),
    lighting = useLightingStore((s) => s.lighting),
    preview = useSceneStore((s) => !!s.preview);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl, objects, lighting, preview]);
  return null;
}
function Metrics() {
  const gl = useThree((s) => s.gl);
  useEffect(() => recordGraphics(gl.getContext()), [gl]);
  useEffect(() => {
    if (
      typeof PerformanceObserver === "undefined" ||
      !PerformanceObserver.supportedEntryTypes?.includes("longtask")
    )
      return;
    performanceMetrics.longTaskSupport(true);
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        performanceMetrics.longTask(entry.startTime, entry.duration);
    });
    observer.observe({ type: "longtask" });
    return () => {
      observer.disconnect();
      performanceMetrics.longTaskSupport(false);
    };
  }, []);
  const timer = useRef({ elapsed: 0, frames: 0 });
  useFrame(({ gl }, delta) => {
    performanceMetrics.render(performance.now(), delta * 1000);
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
export const Scene = memo(function Scene() {
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
        <ShadowCache />
        <StudioEnvironment />
        <Grid />
        <CameraController />
        <Metrics />
        <GestureInteraction />
        <PlacementPreview />
        <StructureControls />
        <PrecisionOverlay />
        <GenerationPreview />
        <SurfaceResources>
          {objects.map((object) => (
            <BuildingObject key={object.id} object={object} />
          ))}
        </SurfaceResources>
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
});
