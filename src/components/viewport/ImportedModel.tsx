import { usePreviewColor } from "../../scene/colorPreview";
import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Mesh, Color } from "three";
import { modelResource } from "../../assets/modelRegistry";
import type { SceneObject } from "../../scene/objectTypes";
import { SurfaceMaterial } from "./SurfaceMaterial";
export function ImportedModel({
  object,
  grabbed,
  highlight,
}: {
  object: SceneObject;
  grabbed: boolean;
  highlight: boolean;
}) {
  const resource = object.model && modelResource(object.model.assetId);
  const preview = usePreviewColor(object.id);
  const tinted = useMemo(
    () =>
      object.model?.originalMaterials
        ? resource?.group.children.map((child) =>
            child instanceof Mesh
              ? {
                  source: Array.isArray(child.material)
                    ? child.material
                    : [child.material],
                  copies: (Array.isArray(child.material)
                    ? child.material
                    : [child.material]
                  ).map((m) => m.clone()),
                }
              : null,
          )
        : undefined,
    [resource, object.model?.originalMaterials],
  );
  useEffect(
    () => () =>
      tinted?.forEach((entry) => entry?.copies.forEach((m) => m.dispose())),
    [tinted],
  );
  useEffect(() => {
    const tint = new Color(preview ?? object.color);
    tinted?.forEach((entry) =>
      entry?.copies.forEach((copy, i) => {
        const source = entry.source[i];
        if (
          "color" in copy &&
          copy.color instanceof Color &&
          "color" in source &&
          source.color instanceof Color
        ) {
          copy.color.copy(source.color);
          if (preview || object.model?.tint) copy.color.multiply(tint);
        }
      }),
    );
  }, [tinted, preview, object.color, object.model?.tint]);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
  }, [resource, grabbed, object.material, gl]);
  if (!resource) return null;
  return (
    <group visible={!grabbed}>
      {resource.group.children.map((child, index) =>
        child instanceof Mesh ? (
          <mesh
            key={index}
            geometry={child.geometry}
            material={
              object.model!.originalMaterials
                ? Array.isArray(child.material)
                  ? tinted?.[index]?.copies
                  : tinted?.[index]?.copies[0]
                : undefined
            }
            castShadow
            receiveShadow
            raycast={() => {}}
          >
            {!object.model!.originalMaterials && (
              <SurfaceMaterial
                object={object}
                grabbed={false}
                highlight={highlight}
              />
            )}
          </mesh>
        ) : null,
      )}
    </group>
  );
}
