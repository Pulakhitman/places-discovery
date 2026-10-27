import { describe, expect, it } from "vitest";
import {
  buildOverpassQuery,
  isPlaceCategoryId,
  isSearchRadiusKm,
} from "./overpass-queries";

describe("overpass query helpers", () => {
  it("validates allowed radii server-side set", () => {
    expect(isSearchRadiusKm(5)).toBe(true);
    expect(isSearchRadiusKm(3)).toBe(false);
    expect(isSearchRadiusKm(25)).toBe(true);
  });

  it("validates category ids", () => {
    expect(isPlaceCategoryId("parks")).toBe(true);
    expect(isPlaceCategoryId("airports")).toBe(false);
  });

  it("builds a parks around query with radius in meters", () => {
    const q = buildOverpassQuery({
      lat: 37.77,
      lng: -122.42,
      radiusM: 5000,
      category: "parks",
    });
    expect(q).toContain("around:5000,37.77,-122.42");
    expect(q).toContain('nwr["leisure"="park"]');
    expect(q).toContain("out center tags");
  });

  it("requires custom keyword for custom category", () => {
    expect(() =>
      buildOverpassQuery({
        lat: 0,
        lng: 0,
        radiusM: 1000,
        category: "custom",
      }),
    ).toThrow(/Custom keyword/);
  });
});
