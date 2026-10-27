import { describe, expect, it } from "vitest";
import {
  buildResultPlaceholders,
  categorySearchBlurb,
} from "./placeholders";

describe("result placeholders", () => {
  it("builds category-specific cards with radius in the subtitle", () => {
    const cards = buildResultPlaceholders("parks", 5);
    expect(cards).toHaveLength(3);
    expect(cards[0]?.subtitle).toContain("5 km");
    expect(cards[0]?.subtitle).toMatch(/Parks/i);
    expect(cards[0]?.title.length).toBeGreaterThan(0);
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
