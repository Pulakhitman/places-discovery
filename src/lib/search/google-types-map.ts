import type { PlaceCategoryId } from "./categories";

/**
 * Map app categories → Places API (New) Table A types for Nearby Search.
 * Custom uses Text Search instead.
 */
export function googleIncludedTypes(
  category: PlaceCategoryId,
): string[] | null {
  switch (category) {
    case "parks":
      return ["park"];
    case "playgrounds":
      return ["playground"];
    case "shops":
      return ["store"];
    case "supermarkets":
      return ["supermarket"];
    case "cafes":
      return ["cafe"];
    case "restaurants":
      return ["restaurant"];
    case "libraries":
      return ["library"];
    case "schools":
      return ["school"];
    case "custom":
      return null;
    default:
      return null;
  }
}
