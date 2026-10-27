export const PLACE_CATEGORIES = [
  { id: "parks", label: "Parks & gardens" },
  { id: "playgrounds", label: "Playgrounds" },
  { id: "shops", label: "Shops" },
  { id: "supermarkets", label: "Supermarkets" },
  { id: "cafes", label: "Cafés" },
  { id: "restaurants", label: "Restaurants" },
  { id: "libraries", label: "Libraries" },
  { id: "schools", label: "Schools" },
  { id: "custom", label: "Custom keyword" },
] as const;

export type PlaceCategoryId = (typeof PLACE_CATEGORIES)[number]["id"];

export const SEARCH_RADII_KM = [1, 2, 5, 10, 25] as const;

export type SearchRadiusKm = (typeof SEARCH_RADII_KM)[number];
