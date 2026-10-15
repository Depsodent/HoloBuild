import { BoxGeometry } from "three";
import { deflateSync } from "node:zlib";
export function checkerPng() {
  const crc = (data: Buffer) => {
    let c = 0xffffffff;
    for (const b of data) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]),
      n = Buffer.alloc(4),
      sum = Buffer.alloc(4);
    n.writeUInt32BE(data.length);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([n, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header[8] = 8;
  header[9] = 6;
  const data = Buffer.from([
    0, 255, 60, 20, 255, 20, 80, 255, 255, 0, 20, 80, 255, 255, 255, 60, 20,
    255,
  ]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(data)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
// Tiny original fixture, usable as embedded GLTF, dependent GLTF+BIN and GLB.
export function modelFixture(
  transform: {
    translation?: number[];
    rotation?: number[];
    scale?: number[];
  } = {},
) {
  const geometry = new BoxGeometry(1, 1.5, 0.8);
  const arrays = [
    geometry.attributes.position.array,
    geometry.attributes.normal.array,
    geometry.attributes.uv.array,
    geometry.index!.array,
  ];
  const bytes = Buffer.concat(
    arrays.map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength)),
  );
  let offset = 0;
  const views = arrays.map((a) => {
    const view = { buffer: 0, byteOffset: offset, byteLength: a.byteLength };
    offset += a.byteLength;
    return view;
  });
  const json = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, ...transform }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
            indices: 3,
            material: 0,
          },
        ],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.8, 0.3, 0.1, 1],
          metallicFactor: 0.1,
          roughnessFactor: 0.5,
        },
      },
    ],
    buffers: [{ byteLength: bytes.length }],
    bufferViews: views,
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 24,
        type: "VEC3",
        min: [-0.5, -0.75, -0.4],
        max: [0.5, 0.75, 0.4],
      },
      { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: 24, type: "VEC2" },
      { bufferView: 3, componentType: 5123, count: 36, type: "SCALAR" },
    ],
  };
  const embedded = JSON.stringify({
    ...json,
    buffers: [
      {
        byteLength: bytes.length,
        uri: `data:application/octet-stream;base64,${bytes.toString("base64")}`,
      },
    ],
  });
  const dependent = JSON.stringify({
    ...json,
    buffers: [{ byteLength: bytes.length, uri: "mesh.bin" }],
  });
  const rawJson = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.concat([
    rawJson,
    Buffer.alloc((4 - (rawJson.length % 4)) % 4, 32),
  ]);
  const binChunk = Buffer.concat([
    bytes,
    Buffer.alloc((4 - (bytes.length % 4)) % 4),
  ]);
  const glb = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binChunk.length);
  glb.writeUInt32LE(0x46546c67, 0);
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(jsonChunk.length, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  jsonChunk.copy(glb, 20);
  const next = 20 + jsonChunk.length;
  glb.writeUInt32LE(binChunk.length, next);
  glb.writeUInt32LE(0x004e4942, next + 4);
  binChunk.copy(glb, next + 8);
  geometry.dispose();
  return { embedded, dependent, bytes, glb };
}
