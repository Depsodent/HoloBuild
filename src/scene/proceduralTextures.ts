import {
  DataTexture,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  LinearMipmapLinearFilter,
} from "three";
import type { TextureKind } from "./materialPresets";
// Original deterministic procedural artwork; no downloads or third-party assets.
export function texturePixels(kind: TextureKind, size = 256) {
  const pixels = new Uint8Array(size * size * 4);
  const noise = (x: number, y: number) => {
    const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        n = noise(x, y);
      let rgb: number[];
      if (kind === "wood") {
        const grain = Math.pow(
          0.5 +
            0.5 *
              Math.sin(
                2 *
                  Math.PI *
                  (u * 32 +
                    Math.sin(v * Math.PI * 2) * 1.2 +
                    Math.sin(v * Math.PI * 8) * 0.25),
              ),
          7,
        );
        const shade = 1 - grain * 0.38 - n * 0.1;
        rgb = [205 * shade, 155 * shade, 91 * shade];
      } else if (kind === "brick") {
        const row = Math.floor(v * 4),
          bx = (u * 2 + (row % 2) * 0.5) % 1,
          by = (v * 4) % 1;
        const mortar = bx < 0.025 || bx > 0.975 || by < 0.055 || by > 0.945;
        rgb = mortar
          ? [157, 151, 136]
          : [167 + n * 28, 73 + n * 18, 49 + n * 16];
      } else if (kind === "concrete") {
        const shade =
          138 +
          n * 42 +
          Math.sin(u * Math.PI * 8) * Math.sin(v * Math.PI * 8) * 8;
        rgb = [shade, shade, shade * 0.96];
      } else {
        const shade = 176 + noise(0, y) * 45 + n * 9;
        rgb = [shade, shade, shade];
      }
      const i = (y * size + x) * 4;
      pixels.set([...rgb.map(Math.round), 255], i);
    }
  return pixels;
}
export function makeSurfaceTextures() {
  return Object.fromEntries(
    (["wood", "brick", "concrete", "brushed-metal"] as const).map((kind) => {
      const texture = new DataTexture(
        texturePixels(kind),
        256,
        256,
        RGBAFormat,
      );
      texture.wrapS = texture.wrapT = RepeatWrapping;
      texture.colorSpace = SRGBColorSpace;
      texture.generateMipmaps = true;
      texture.minFilter = LinearMipmapLinearFilter;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
      return [kind, texture];
    }),
  ) as Record<TextureKind, DataTexture>;
}
