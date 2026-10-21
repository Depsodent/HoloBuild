export interface FurniturePart {
  shape: "box" | "cylinder" | "sphere" | "cone";
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  tone: number;
}
export interface FurnitureDefinition {
  id: string;
  name: string;
  category: string;
  size: [number, number, number];
  parts: FurniturePart[];
  attachment: "floor" | "surface" | "wall" | "ceiling";
  color: string;
  material: "wood" | "matte-plastic";
}
export const FURNITURE: Readonly<Record<string, FurnitureDefinition>>;
export const FURNITURE_IDS: readonly string[];
export const FURNITURE_CATEGORIES: readonly string[];
export function searchFurniture(
  query?: string,
  category?: string,
): FurnitureDefinition[];
