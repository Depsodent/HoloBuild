import { MATERIAL_PRESETS, presetValues } from "./materialPresets";
import type { SceneObject } from "./objectTypes";
export function surfaceValues(object: SceneObject) {
  const values = {
    ...presetValues(object.material),
    roughness: MATERIAL_PRESETS[object.material].roughness,
    metalness: MATERIAL_PRESETS[object.material].metalness,
    opacity: MATERIAL_PRESETS[object.material].opacity,
    ...object.surface,
  };
  return {
    ...values,
    transparent: values.transparent || values.opacity < 1,
    depthWrite: values.opacity < 1 ? false : values.depthWrite,
  };
}
export function surfaceControls(object: SceneObject) {
  const preset = MATERIAL_PRESETS[object.material];
  return [
    {
      key: "roughness",
      label: "Roughness",
      max: 1,
      min: 0,
      step: 0.05,
      value: object.surface?.roughness ?? preset.roughness,
    },
    ...(["solid", "polished-metal"].includes(object.material)
      ? [
          {
            key: "metalness",
            label: "Metalness",
            min: 0,
            max: 1,
            step: 0.05,
            value: object.surface?.metalness ?? preset.metalness,
          },
        ]
      : []),
    ...(preset.transparent
      ? [
          {
            key: "opacity",
            label: "Opacity",
            min: 0.05,
            max: 1,
            step: 0.05,
            value: object.surface?.opacity ?? preset.opacity,
          },
        ]
      : []),
    ...(preset.holographic
      ? [
          {
            key: "emissiveIntensity",
            label: "Emission intensity",
            min: 0,
            max: 3,
            step: 0.1,
            value:
              object.surface?.emissiveIntensity ?? preset.emissiveIntensity,
          },
        ]
      : []),
    ...(preset.texture
      ? [
          {
            key: "textureScale",
            label: "Texture repeats per metre",
            min: 0.25,
            max: 8,
            step: 0.25,
            value: object.surface?.textureScale ?? 1,
          },
        ]
      : []),
  ];
}
