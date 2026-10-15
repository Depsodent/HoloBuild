import type { MeshPhysicalMaterialParameters } from "three";
export const MATERIAL_IDS = [
  "solid",
  "glass",
  "matte-plastic",
  "glossy-plastic",
  "polished-metal",
  "holographic",
  "wood",
  "brick",
  "concrete",
] as const;
export type MaterialId = (typeof MATERIAL_IDS)[number];
export type TextureKind = "wood" | "brick" | "concrete" | "brushed-metal";
interface SurfacePreset extends MeshPhysicalMaterialParameters {
  roughness: number;
  metalness: number;
  transmission: number;
  opacity: number;
  emissiveIntensity: number;
  label: string;
  texture?: TextureKind;
  holographic?: boolean;
}
const base = {
  transmission: 0,
  opacity: 1,
  transparent: false,
  clearcoat: 0,
  clearcoatRoughness: 0.25,
  thickness: 0,
  ior: 1.5,
  envMapIntensity: 0.8,
  depthWrite: true,
  emissiveIntensity: 0,
};
// Keep the two existing scene IDs and their optical values compatible.
export const MATERIAL_PRESETS: Record<MaterialId, SurfacePreset> = {
  solid: {
    ...base,
    label: "Satin metal",
    roughness: 0.38,
    metalness: 0.65,
    clearcoat: 0.2,
    texture: "brushed-metal",
  },
  glass: {
    ...base,
    label: "Glass",
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
  "matte-plastic": {
    ...base,
    label: "Matte plastic",
    roughness: 0.94,
    metalness: 0,
    envMapIntensity: 0.35,
  },
  "glossy-plastic": {
    ...base,
    label: "Glossy plastic",
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  },
  "polished-metal": {
    ...base,
    label: "Polished metal",
    roughness: 0.08,
    metalness: 1,
    clearcoat: 0.35,
    envMapIntensity: 1.6,
  },
  holographic: {
    ...base,
    label: "Holographic",
    roughness: 0.2,
    metalness: 0.15,
    opacity: 0.32,
    transparent: true,
    depthWrite: false,
    emissiveIntensity: 0.65,
    holographic: true,
  },
  wood: {
    ...base,
    label: "Wood",
    roughness: 0.72,
    metalness: 0,
    texture: "wood",
    clearcoat: 0.08,
  },
  brick: {
    ...base,
    label: "Brick",
    roughness: 0.98,
    metalness: 0,
    texture: "brick",
    envMapIntensity: 0.25,
  },
  concrete: {
    ...base,
    label: "Concrete",
    roughness: 0.9,
    metalness: 0,
    texture: "concrete",
    envMapIntensity: 0.35,
  },
};
export function presetValues(id: MaterialId): MeshPhysicalMaterialParameters {
  const { label, texture, holographic, ...values } = MATERIAL_PRESETS[id];
  void label;
  void texture;
  void holographic;
  return values;
}
