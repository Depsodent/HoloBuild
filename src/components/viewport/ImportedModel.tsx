import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Mesh } from "three";
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
              object.model!.originalMaterials ? child.material : undefined
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
