import {
  Box3,
  Group,
  Mesh,
  Matrix4,
  Vector3,
  LoadingManager,
  Texture,
  type Material,
  type BufferGeometry,
} from "three";
import { decodeBytes, validateAsset, type ModelAsset } from "./assetTypes";
import type { Vec3 } from "../scene/objectTypes";
export interface ModelResource {
  group: Group;
  size: Vec3;
  triangles: number;
  estimatedBytes: number;
  dispose: () => void;
}
export function disposeModel(group: Group) {
  const geometries = new Set<BufferGeometry>(),
    materials = new Set<Material>(),
    textures = new Set<Texture>();
  group.traverse((node) => {
    if (node instanceof Mesh) {
      geometries.add(node.geometry);
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material]) {
        materials.add(material);
        Object.values(material).forEach((value) => {
          if (value instanceof Texture) textures.add(value);
        });
      }
    }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => {
    t.dispose();
    const image = t.source.data;
    if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap)
      image.close();
  });
}
// Reject network references before parsing, including those hidden inside GLB JSON.
export function modelManifest(bytes: Uint8Array) {
  if (bytes.length < 4) throw Error("Invalid model file.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) === 0x46546c67) {
    if (
      bytes.length < 20 ||
      view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== bytes.length ||
      view.getUint32(16, true) !== 0x4e4f534a ||
      view.getUint32(12, true) > bytes.length - 20
    )
      throw Error("Invalid GLB version or length.");
    return JSON.parse(
      new TextDecoder().decode(
        bytes.subarray(20, 20 + view.getUint32(12, true)),
      ),
    );
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function loadModel(input: ModelAsset): Promise<ModelResource> {
  const asset = validateAsset(input),
    files = new Map(asset.files.map((f) => [f.name, decodeBytes(f.data)]));
  const bytes = files.get(asset.main)!;
  const manifest = modelManifest(bytes);
  if (manifest.asset?.version !== "2.0")
    throw Error("Only glTF 2.0 models are supported.");
  if (
    (manifest.accessors ?? []).some(
      (a: { count: number }) => a.count > 1000000,
    ) ||
    (manifest.accessors ?? []).reduce(
      (n: number, a: { count: number }) => n + a.count,
      0,
    ) > 4000000
  )
    throw Error(
      "Model accessor budget exceeded. Simplify it before importing.",
    );
  if (
    manifest.extensionsRequired?.some((name: string) =>
      [
        "KHR_draco_mesh_compression",
        "EXT_meshopt_compression",
        "KHR_texture_basisu",
      ].includes(name),
    )
  )
    throw Error(
      "Compressed Draco, Meshopt and KTX2 models are unsupported. Export an uncompressed GLB.",
    );
  const filename = (uri: string) => {
    if (
      /^(?:[a-z][a-z0-9+.-]*:|\/|\\)/i.test(uri) ||
      uri.split("/").includes("..")
    )
      throw Error(
        "External model URLs are unsupported. Select local dependencies with the GLTF.",
      );
    return decodeURIComponent(uri.split("/").at(-1)!);
  };
  for (const ref of [...(manifest.buffers ?? []), ...(manifest.images ?? [])]) {
    if (
      ref.uri &&
      !ref.uri.startsWith("data:") &&
      !files.has(filename(ref.uri))
    )
      throw Error(
        `Missing dependency: ${ref.uri}. Select it together with the GLTF.`,
      );
  }
  const urls = new Map<string, string>();
  const manager = new LoadingManager();
  manager.setURLModifier((uri) => {
    if (uri.startsWith("data:") || uri.startsWith("blob:")) return uri;
    const name = filename(uri),
      content = files.get(name);
    if (!content) throw Error(`Missing dependency: ${name}`);
    if (!urls.has(name))
      urls.set(
        name,
        URL.createObjectURL(new Blob([content as Uint8Array<ArrayBuffer>])),
      );
    return urls.get(name)!;
  });
  let source: Group | undefined;
  const group = new Group();
  try {
    const { GLTFLoader } =
      await import("three/examples/jsm/loaders/GLTFLoader.js");
    const gltf = await new GLTFLoader(manager).parseAsync(
      bytes.buffer as ArrayBuffer,
      "",
    );
    source = gltf.scene;
    source.updateMatrixWorld(true);
    const box = new Box3().setFromObject(source),
      size = box.getSize(new Vector3()),
      center = box.getCenter(new Vector3());
    const longest = Math.max(size.x, size.y, size.z);
    if (box.isEmpty() || !Number.isFinite(longest) || longest <= 0)
      throw Error("Model has no finite mesh geometry.");
    const factor = 2 / longest,
      normalization = new Matrix4()
        .makeScale(factor, factor, factor)
        .multiply(
          new Matrix4().makeTranslation(-center.x, -center.y, -center.z),
        );
    let triangles = 0,
      meshes = 0;
    source.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      if (
        "isSkinnedMesh" in node ||
        "isInstancedMesh" in node ||
        Object.keys(node.geometry.morphAttributes).length
      )
        throw Error(
          "Skinned/morph/instanced models are unsupported. Export a static mesh.",
        );
      triangles +=
        (node.geometry.index?.count ??
          node.geometry.getAttribute("position")?.count ??
          0) / 3;
      if (triangles > 250000 || ++meshes > 256)
        throw Error(
          "Model exceeds 250,000 triangles or 256 meshes. Simplify it before importing.",
        );
      const geometry = node.geometry
        .clone()
        .applyMatrix4(normalization.clone().multiply(node.matrixWorld));
      // Baking a mirrored node removes Three's transform-based winding flip.
      if (node.matrixWorld.determinant() < 0) {
        const count =
          geometry.index?.count ?? geometry.getAttribute("position").count;
        const indices = geometry.index
          ? Array.from(geometry.index.array)
          : Array.from({ length: count }, (_, i) => i);
        for (let i = 0; i < indices.length; i += 3)
          [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
        geometry.setIndex(indices);
      }
      const mesh = new Mesh(geometry, node.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    });
    if (!meshes) throw Error("Model contains no supported meshes.");
    let estimatedBytes = 0,
      pixels = 0;
    const textures = new Set<Texture>();
    group.traverse((node) => {
      if (node instanceof Mesh) {
        Object.values((node.geometry as BufferGeometry).attributes).forEach(
          (a) => {
            estimatedBytes += a.array.byteLength;
          },
        );
        estimatedBytes += node.geometry.index?.array.byteLength ?? 0;
        for (const material of Array.isArray(node.material)
          ? node.material
          : [node.material])
          Object.values(material).forEach((value) => {
            if (value instanceof Texture) textures.add(value);
          });
      }
    });
    for (const texture of textures) {
      const image = texture.source.data,
        w = Number(image?.width ?? 0),
        h = Number(image?.height ?? 0);
      if (w > 4096 || h > 4096)
        throw Error(
          "Model texture exceeds 4096 pixels per side. Resize it before importing.",
        );
      pixels += w * h;
    }
    if (pixels > 16 * 1024 * 1024)
      throw Error("Model texture pixel budget exceeded (16 megapixels).");
    estimatedBytes += Math.ceil((pixels * 4 * 4) / 3);
    // Original geometries were replaced by baked, normalized shared geometries.
    const originals = new Set<BufferGeometry>();
    source.traverse((n) => {
      if (n instanceof Mesh) originals.add(n.geometry);
    });
    originals.forEach((g) => g.dispose());
    const normalized = size
      .multiplyScalar(factor)
      .toArray()
      .map((v) => Math.max(v, 0.001)) as Vec3;
    return {
      group,
      size: normalized,
      triangles: Math.round(triangles),
      estimatedBytes,
      dispose: () => disposeModel(group),
    };
  } catch (error) {
    disposeModel(group);
    if (source) disposeModel(source);
    throw error;
  } finally {
    urls.forEach((url) => URL.revokeObjectURL(url));
  }
}
