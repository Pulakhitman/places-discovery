import { describe, expect, it } from "vitest";
import { computeOsmCoverage } from "./coverage";
import type { OsmPlace } from "./types";

function place(partial: Partial<OsmPlace> & Pick<OsmPlace, "id">): OsmPlace {
  return {
    osmType: "node",
    osmId: 1,
    name: partial.name ?? "Place",
    isUnnamed: false,
    categoryId: "parks",
    categoryLabel: "Parks & gardens",
    lat: 1,
    lng: 2,
    distanceM: 100,
    tags: {},
    sources: { osm: true },
    ...partial,
  };
}

describe("computeOsmCoverage", () => {
  it("floors tiny non-zero shares to 1% instead of rounding to 0", () => {
    const places = Array.from({ length: 300 }, (_, i) =>
      place({
        id: `p-${i}`,
        hours: i === 0 ? "24/7" : undefined,
      }),
    );
    const coverage = computeOsmCoverage(places);
    expect(coverage.withHours).toBe(1);
    expect(coverage.hoursPct).toBe(1);
    expect(coverage.websitePct).toBe(0);
  });
});
