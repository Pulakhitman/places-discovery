import { describe, expect, it } from "vitest";
import {
  buildMapPlaceholders,
  buildResultPlaceholders,
  categorySearchBlurb,
  offsetLatLng,
} from "./placeholders";

describe("result placeholders", () => {
  it("builds category-specific cards with radius in the subtitle", () => {
    const cards = buildResultPlaceholders("parks", 5);
    expect(cards).toHaveLength(3);
    expect(cards[0]?.subtitle).toContain("5 km");
    expect(cards[0]?.subtitle).toMatch(/Parks/i);
    expect(cards[0]?.title).toBe("Riverside Park");
    expect(cards.map((c) => c.title)).toEqual([
      "Riverside Park",
      "Community Garden",
      "Sunset Meadow Park",
    ]);
    expect(cards.every((c) => c.category === "parks")).toBe(true);
  });

  it("mentions custom keyword and radius in the blurb", () => {
    const blurb = categorySearchBlurb("custom", 2, "bakery");
    expect(blurb).toContain("bakery");
    expect(blurb).toContain("2 km");
  });

  it("describes cafés within the chosen radius", () => {
    expect(categorySearchBlurb("cafes", 10)).toContain("10 km");
    expect(categorySearchBlurb("cafes", 10).toLowerCase()).toContain("café");
  });
});

describe("map placeholders", () => {
  const center = { lat: 37.77, lng: -122.42 };

  it("places sample pins inside the search radius with matching titles", () => {
    const pins = buildMapPlaceholders(center, "parks", 5);
    expect(pins).toHaveLength(3);
    expect(pins.map((p) => p.title)).toEqual([
      "Riverside Park",
      "Community Garden",
      "Sunset Meadow Park",
    ]);
    expect(pins.every((p) => p.category === "parks")).toBe(true);

    for (const pin of pins) {
      const dLat = ((pin.lat - center.lat) * Math.PI) / 180;
      const dLng = ((pin.lng - center.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((center.lat * Math.PI) / 180) *
          Math.cos((pin.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const distM = 2 * 6371000 * Math.asin(Math.sqrt(a));
      expect(distM).toBeLessThan(5 * 1000);
      expect(distM).toBeGreaterThan(1000);
    }
  });

  it("offsetLatLng moves roughly the requested distance north", () => {
    const north = offsetLatLng(center, 1000, 0);
    expect(north.lat).toBeGreaterThan(center.lat);
    expect(Math.abs(north.lng - center.lng)).toBeLessThan(0.001);
  });
});
