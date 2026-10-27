import { describe, expect, it } from "vitest";
import { resolvePlaceName } from "./place-name";

describe("resolvePlaceName", () => {
  it("prefers name tags", () => {
    expect(
      resolvePlaceName({ name: "Dolores Park", leisure: "park" }, "parks"),
    ).toEqual({ name: "Dolores Park", isUnnamed: false });
  });

  it("falls back to leisure type instead of way/id", () => {
    expect(resolvePlaceName({ leisure: "garden" }, "parks")).toEqual({
      name: "Unnamed garden",
      isUnnamed: true,
    });
  });

  it("uses brand when name is missing", () => {
    expect(
      resolvePlaceName({ brand: "Starbucks", amenity: "cafe" }, "cafes"),
    ).toEqual({ name: "Starbucks", isUnnamed: false });
  });
});
