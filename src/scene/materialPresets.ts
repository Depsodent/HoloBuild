// Existing scene identifiers remain stable for undo and version-1 JSON.
export const MATERIAL_PRESETS = {
  solid: {
    roughness: 0.38,
    metalness: 0.65,
    transmission: 0,
    opacity: 1,
    transparent: false,
    clearcoat: 0.2,
    clearcoatRoughness: 0.25,
    thickness: 0,
    ior: 1.5,
    envMapIntensity: 0.8,
    depthWrite: true,
  },
  glass: {
    roughness: 0.07,
    metalness: 0,
    transmission: 0.65,
    opacity: 0.55,
    transparent: true,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    thickness: 0.3,
    ior: 1.45,
    envMapIntensity: 1.2,
    depthWrite: false,
  },
} as const;
