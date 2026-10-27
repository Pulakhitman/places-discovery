import type { PlaceCategoryId, SearchRadiusKm } from "./categories";
import { categoryLabel } from "./overpass-queries";

export type ResultPlaceholderCard = {
  title: string;
  subtitle: string;
  address: string;
  hours: string;
  website: string;
  phone: string;
};

const CATEGORY_SAMPLES: Record<
  Exclude<PlaceCategoryId, "custom">,
  { titles: string[]; addressHint: string; what: string }
> = {
  parks: {
    what: "parks and gardens",
    addressHint: "Park entrance or garden path",
    titles: ["Neighborhood park", "City garden", "Riverside green"],
  },
  playgrounds: {
    what: "playgrounds",
    addressHint: "Play area near a park or school",
    titles: ["Local playground", "Toddler play area", "Schoolyard play"],
  },
  shops: {
    what: "shops",
    addressHint: "Storefront address",
    titles: ["Local shop", "Corner store", "Specialty retail"],
  },
  supermarkets: {
    what: "supermarkets",
    addressHint: "Grocery store address",
    titles: ["Neighborhood market", "Grocery store", "Food hall"],
  },
  cafes: {
    what: "cafés",
    addressHint: "Café street address",
    titles: ["Corner café", "Coffee shop", "Tea house"],
  },
  restaurants: {
    what: "restaurants",
    addressHint: "Restaurant address",
    titles: ["Neighborhood restaurant", "Family diner", "Local eatery"],
  },
  libraries: {
    what: "libraries",
    addressHint: "Library branch address",
    titles: ["Public library", "Branch library", "Reading room"],
  },
  schools: {
    what: "schools",
    addressHint: "School campus address",
    titles: ["Primary school", "Secondary school", "Community school"],
  },
};

export function categorySearchBlurb(
  category: PlaceCategoryId,
  radiusKm: SearchRadiusKm,
  customKeyword?: string,
): string {
  if (category === "custom") {
    const kw = customKeyword?.trim() || "your keyword";
    return `Places matching “${kw}” within ${radiusKm} km of the map center.`;
  }
  const sample = CATEGORY_SAMPLES[category];
  return `${categoryLabel(category)} — nearby ${sample.what} within ${radiusKm} km of the map center.`;
}

export function buildResultPlaceholders(
  category: PlaceCategoryId,
  radiusKm: SearchRadiusKm,
  customKeyword?: string,
): ResultPlaceholderCard[] {
  if (category === "custom") {
    const kw = customKeyword?.trim() || "keyword";
    return [1, 2, 3].map((n) => ({
      title: n === 1 ? `Match for “${kw}”` : `Match for “${kw}” (${n})`,
      subtitle: `Custom · within ${radiusKm} km`,
      address: "Address when tagged in OSM",
      hours: "Opening hours when tagged",
      website: "Website when tagged",
      phone: "Phone when tagged",
    }));
  }

  const sample = CATEGORY_SAMPLES[category];
  return sample.titles.map((title) => ({
    title,
    subtitle: `${categoryLabel(category)} · within ${radiusKm} km`,
    address: sample.addressHint,
    hours: "Opening hours when tagged",
    website: "Website when tagged",
    phone: "Phone when tagged",
  }));
}
