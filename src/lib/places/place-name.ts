import type { PlaceCategoryId } from "@/lib/search/categories";
import { categoryLabel } from "@/lib/search/overpass-queries";

const NAME_KEYS = [
  "name",
  "name:en",
  "official_name",
  "official_name:en",
  "alt_name",
  "alt_name:en",
  "loc_name",
  "short_name",
  "short_name:en",
  "brand",
  "brand:en",
  "operator",
  "operator:en",
  "ref",
  "inscription",
] as const;

function humanizeTag(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Best available display name from OSM tags, with a human label when unnamed.
 */
export function resolvePlaceName(
  tags: Record<string, string>,
  categoryId: PlaceCategoryId,
): { name: string; isUnnamed: boolean } {
  for (const key of NAME_KEYS) {
    const value = tags[key]?.trim();
    if (value) {
      return { name: value, isUnnamed: false };
    }
  }

  // Any localized name:* tag
  for (const [key, value] of Object.entries(tags)) {
    if (key.startsWith("name:") && value?.trim()) {
      return { name: value.trim(), isUnnamed: false };
    }
  }

  const kind =
    tags.leisure?.trim() ||
    tags.amenity?.trim() ||
    tags.shop?.trim() ||
    tags.tourism?.trim() ||
    tags.landuse?.trim();

  if (kind) {
    return {
      name: `Unnamed ${humanizeTag(kind).toLowerCase()}`,
      isUnnamed: true,
    };
  }

  return {
    name: `Unnamed ${categoryLabel(categoryId).toLowerCase().replace(/ & /g, "/")}`,
    isUnnamed: true,
  };
}
