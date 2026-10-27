import { describe, expect, it } from "vitest";
import { buildShareSearchParams, parseShareSearchParams } from "./share-url";

describe("share-url", () => {
  it("parses valid deep-link params", () => {
    const parsed = parseShareSearchParams(
      "lat=37.7749&lng=-122.4194&radius=5&category=cafes&mode=radius&q=bakery",
    );
    expect(parsed).toEqual({
      lat: 37.7749,
      lng: -122.4194,
      radiusKm: 5,
      category: "cafes",
      mode: "radius",
      q: "bakery",
    });
  });

  it("ignores invalid coords and categories", () => {
    const parsed = parseShareSearchParams(
      "lat=999&lng=1&radius=3&category=nope&mode=warp",
    );
    expect(parsed.lat).toBeUndefined();
    expect(parsed.radiusKm).toBeUndefined();
    expect(parsed.category).toBeUndefined();
    expect(parsed.mode).toBeUndefined();
  });

  it("builds a stable query string", () => {
    const qs = buildShareSearchParams({
      lat: 37.77491,
      lng: -122.41941,
      radiusKm: 10,
      category: "parks",
      mode: "area",
    });
    expect(qs).toContain("lat=37.77491");
    expect(qs).toContain("lng=-122.41941");
    expect(qs).toContain("radius=10");
    expect(qs).toContain("category=parks");
    expect(qs).toContain("mode=area");
    expect(qs).not.toContain("q=");
  });
});
