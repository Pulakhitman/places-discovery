import type { PlaceCategoryId, SearchRadiusKm } from "./categories";
import { categoryLabel } from "./overpass-queries";

export type ResultPlaceholderCard = {
  title: string;
  subtitle: string;
  address: string;
  hours: string;
  website: string;
  phone: string;
  category: PlaceCategoryId;
};

const CATEGORY_SAMPLES: Record<
  Exclude<PlaceCategoryId, "custom">,
  { titles: string[]; addressHint: string; what: string }
> = {
  parks: {
    what: "parks and gardens",
    addressHint: "Park lane / garden entrance",
    titles: [
      "Riverside Park",
      "Community Garden",
      "Sunset Meadow Park",
    ],
  },
  playgrounds: {
    what: "playgrounds",
    addressHint: "Play area near a park or school",
    titles: [
      "Oak Street Playground",
      "Little Explorers Play Area",
      "Hilltop Playground",
    ],
  },
  shops: {
    what: "shops",
    addressHint: "High street storefront",
    titles: ["Corner Bookshop", "Maple Hardware", "Bluebird Boutique"],
  },
  supermarkets: {
    what: "supermarkets",
    addressHint: "Grocery store entrance",
    titles: ["Fresh Valley Market", "City Grocer", "Harbor Foods"],
  },
  cafes: {
    what: "cafés",
    addressHint: "Café storefront",
    titles: ["Morning Bean Café", "Willow Tea Room", "Harbor Roast"],
  },
  restaurants: {
    what: "restaurants",
    addressHint: "Restaurant entrance",
    titles: ["Olive Table", "North Bridge Kitchen", "Lantern House"],
  },
  libraries: {
    what: "libraries",
    addressHint: "Library branch entrance",
    titles: [
      "Central Public Library",
      "Westside Branch Library",
      "River Reading Room",
    ],
  },
  schools: {
    what: "schools",
    addressHint: "School main gate",
    titles: [
      "Greenfield Primary School",
      "Lakeside Secondary School",
      "Community Learning School",
    ],
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
      title:
        n === 1
          ? `${kw.charAt(0).toUpperCase()}${kw.slice(1)} spot`
          : `${kw.charAt(0).toUpperCase()}${kw.slice(1)} spot ${n}`,
      subtitle: `Custom · within ${radiusKm} km`,
      address: "Street address when tagged in OSM",
      hours: "Opening hours when tagged",
      website: "Website when tagged",
      phone: "Phone when tagged",
      category: "custom",
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
    category,
  }));
}

export type MapPlaceholderPin = {
  id: string;
  title: string;
  category: PlaceCategoryId;
  lat: number;
  lng: number;
};

/** Offset a lat/lng by distance meters at a compass bearing (degrees). */
export function offsetLatLng(
  center: { lat: number; lng: number },
  distanceM: number,
  bearingDeg: number,
): { lat: number; lng: number } {
  const R = 6371000;
  const δ = distanceM / R;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (center.lat * Math.PI) / 180;
  const λ1 = (center.lng * Math.PI) / 180;

  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);

  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * sinδ * cosφ1, cosδ - sinφ1 * sinφ2);

  return {
    lat: (φ2 * 180) / Math.PI,
    lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

/**
 * Sample pins inside the search radius for idle/loading preview on the map.
 * Same titles as the results-list placeholders.
 */
export function buildMapPlaceholders(
  center: { lat: number; lng: number },
  category: PlaceCategoryId,
  radiusKm: SearchRadiusKm,
  customKeyword?: string,
): MapPlaceholderPin[] {
  const cards = buildResultPlaceholders(category, radiusKm, customKeyword);
  const bearings = [35, 155, 265];
  const radiusFracs = [0.42, 0.55, 0.48];

  return cards.map((card, index) => {
    const distanceM = radiusKm * 1000 * (radiusFracs[index] ?? 0.5);
    const pos = offsetLatLng(center, distanceM, bearings[index] ?? 0);
    return {
      id: `ph-${category}-${index}`,
      title: card.title,
      category: card.category,
      lat: pos.lat,
      lng: pos.lng,
    };
  });
}
