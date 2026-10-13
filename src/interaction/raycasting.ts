import { Plane, Raycaster, Vector3, type Camera, type Scene } from "three";
import { toNdc, type Cursor } from "./coordinateMapping";
export function createRaycasting(camera: Camera, scene: Scene) {
  const raycaster = new Raycaster();
  const plane = new Plane(new Vector3(0, 1, 0), 0);
  const hit = new Vector3();
  return {
    pick(cursor: Cursor) {
      raycaster.setFromCamera(toNdc(cursor), camera);
      const objects = scene.children.flatMap((child) => {
        const matches: (typeof child)[] = [];
        child.traverse((o) => {
          if (o.userData.objectId) matches.push(o);
        });
        return matches;
      });
      const intersection = raycaster.intersectObjects(objects, false)[0];
      return intersection?.object.userData.objectId as string | undefined;
    },
    plane(cursor: Cursor, height: number) {
      raycaster.setFromCamera(toNdc(cursor), camera);
      plane.constant = -height;
      return raycaster.ray.intersectPlane(plane, hit)
        ? (hit.toArray() as [number, number, number])
        : null;
    },
  };
}
