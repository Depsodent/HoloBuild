import { usePreviewColor } from "../../scene/colorPreview";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Vector3, type MeshPhysicalMaterial } from "three";
import { MATERIAL_PRESETS } from "../../scene/materialPresets";
import { makeSurfaceTextures } from "../../scene/proceduralTextures";
import { surfaceValues } from "../../scene/surface";
import type { SceneObject } from "../../scene/objectTypes";
const Resources = createContext<ReturnType<typeof makeSurfaceTextures> | null>(
  null,
);
export function SurfaceResources({ children }: { children: ReactNode }) {
  const textures = useMemo(makeSurfaceTextures, []);
  useEffect(() => {
    Object.values(textures).forEach((t) => {
      t.needsUpdate = true;
    });
    return () => Object.values(textures).forEach((t) => t.dispose());
  }, [textures]);
  return <Resources.Provider value={textures}>{children}</Resources.Provider>;
}
export function SurfaceMaterial({
  object,
  grabbed,
  highlight,
}: {
  object: SceneObject;
  grabbed: boolean;
  highlight: boolean;
}) {
  const color = usePreviewColor(object.id) ?? object.color;
  const resources = useContext(Resources);
  const ref = useRef<MeshPhysicalMaterial>(null);
  const time = useMemo(() => ({ value: 0 }), []);
  const preset = MATERIAL_PRESETS[object.material];
  const values = surfaceValues(object);
  const texture = preset.texture ? resources?.[preset.texture] : undefined;
  const dimensions = object.scale.join(",");
  const configure = useMemo(
    () =>
      (
        shader: Parameters<
          NonNullable<MeshPhysicalMaterial["onBeforeCompile"]>
        >[0],
      ) => {
        shader.uniforms.surfaceTime = time;
        shader.uniforms.surfaceTexture = { value: texture };
        shader.uniforms.surfaceRepeat = {
          value: object.surface?.textureScale ?? 1,
        };
        shader.uniforms.surfaceSize = { value: new Vector3(...object.scale) };
        shader.vertexShader =
          "varying vec3 surfacePosition; varying vec3 surfaceNormal; uniform vec3 surfaceSize;\n" +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nsurfacePosition = position * surfaceSize; surfaceNormal = normal;",
        );
        shader.fragmentShader =
          "varying vec3 surfacePosition; varying vec3 surfaceNormal; uniform sampler2D surfaceTexture; uniform float surfaceRepeat; uniform float surfaceTime;\n" +
          shader.fragmentShader;
        if (texture)
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <map_fragment>",
            `
      vec3 w = pow(abs(normalize(surfaceNormal)), vec3(8.0)); w /= max(w.x+w.y+w.z, 0.0001);
      vec3 texel = texture2D(surfaceTexture, surfacePosition.yz * surfaceRepeat).rgb * w.x
        + texture2D(surfaceTexture, surfacePosition.xz * surfaceRepeat).rgb * w.y
        + texture2D(surfaceTexture, surfacePosition.xy * surfaceRepeat).rgb * w.z;
      diffuseColor.rgb *= texel;
    `,
          );
        if (preset.holographic)
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <opaque_fragment>",
            `
      float stripe = pow(0.5 + 0.5 * sin(surfacePosition.y * 35.0 - surfaceTime * 1.5), 12.0);
      float rim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);
      outgoingLight += emissive * (0.5 + stripe * 2.0 + rim * 1.5);
      #include <opaque_fragment>
    `,
          );
      },
    [
      texture,
      preset.holographic,
      object.scale,
      object.surface?.textureScale,
      time,
    ],
  );
  useFrame((_, delta) => {
    if (preset.holographic) time.value += delta;
  });
  const { textureScale: ignored, ...optics } = values;
  void ignored;
  return (
    <meshPhysicalMaterial
      key={`${object.material}:${dimensions}:${object.surface?.textureScale}`}
      ref={ref}
      {...optics}
      color={
        preset.holographic
          ? new Color(color).lerp(new Color("#28cbff"), 0.65)
          : color
      }
      transparent={grabbed || preset.transparent}
      opacity={grabbed ? 0.2 : values.opacity}
      emissive={preset.holographic ? "#25cfff" : color}
      emissiveIntensity={
        (values.emissiveIntensity ?? 0) + (highlight ? 0.15 : 0)
      }
      onBeforeCompile={configure}
      customProgramCacheKey={() => `${!!texture}:${!!preset.holographic}`}
    />
  );
}
