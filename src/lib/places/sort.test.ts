import { describe, expect, it } from "vitest";
import { sortPlaces } from "./sort";
import type { OsmPlace } from "./types";

function place(
  partial: Partial<OsmPlace> & Pick<OsmPlace, "id" | "name" | "distanceM">,
): OsmPlace {
  return {
    osmType: "node",
    osmId: 1,
    isUnnamed: false,
    categoryId: "parks",
    categoryLabel: "Parks & gardens",
    lat: 1,
    lng: 2,
    tags: {},
    sources: { osm: true },
    ...partial,
  };
}

describe("sortPlaces", () => {
  const places = [
    place({ id: "b", name: "Beta", distanceM: 300, address: "x" }),
    place({
      id: "a",
      name: "Alpha",
      distanceM: 900,
      address: "y",
      hours: "24/7",
      website: "https://a.test",
      phone: "1",
    }),
    place({ id: "c", name: "Gamma", distanceM: 100, isUnnamed: true }),
  ];

  it("sorts by distance", () => {
    expect(sortPlaces(places, "distance").map((p) => p.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });

  it("sorts by name", () => {
    expect(sortPlaces(places, "name").map((p) => p.name)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
    ]);
  });

  it("sorts by completeness then distance", () => {
    expect(sortPlaces(places, "completeness").map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
