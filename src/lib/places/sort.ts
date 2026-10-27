import type { OsmPlace } from "./types";

export type PlaceSortId = "distance" | "name" | "completeness";

export const PLACE_SORT_OPTIONS: { id: PlaceSortId; label: string }[] = [
  { id: "distance", label: "Distance" },
  { id: "name", label: "Name" },
  { id: "completeness", label: "Most tagged fields" },
];

function fieldScore(place: OsmPlace): number {
  let score = 0;
  if (!place.isUnnamed) {
    score += 1;
  }
  if (place.address) {
    score += 1;
  }
  if (place.hours) {
    score += 1;
  }
  if (place.website) {
    score += 1;
  }
  if (place.phone) {
    score += 1;
  }
  return score;
}

export function sortPlaces(
  places: OsmPlace[],
  sort: PlaceSortId,
): OsmPlace[] {
  const next = [...places];
  switch (sort) {
    case "name":
      next.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
      break;
    case "completeness":
      next.sort((a, b) => {
        const scoreDiff = fieldScore(b) - fieldScore(a);
        if (scoreDiff !== 0) {
          return scoreDiff;
        }
        return a.distanceM - b.distanceM;
      });
      break;
    case "distance":
    default:
      next.sort((a, b) => a.distanceM - b.distanceM);
      break;
  }
  return next;
}
