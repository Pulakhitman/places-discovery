import { describe, expect, it } from "vitest";
import {
  nameSimilarity,
  normalizePlaceName,
  scoreGoogleMatch,
} from "./google-match";

describe("google match helpers", () => {
  it("normalizes punctuation and case", () => {
    expect(normalizePlaceName("Café Roma!")).toBe("cafe roma");
  });

  it("scores identical names highly", () => {
    expect(nameSimilarity("Dolores Park", "Dolores Park")).toBe(1);
  });

  it("marks a close nearby name as strong", () => {
    const match = scoreGoogleMatch({
      queriedName: "Dolores Park",
      googleName: "Mission Dolores Park",
      queryLat: 37.7596,
      queryLng: -122.4269,
      googleLat: 37.7597,
      googleLng: -122.427,
    });
    expect(match.confidence).toBe("strong");
    expect(match.distanceM).toBeLessThan(50);
  });

  it("marks a distant or dissimilar name as weak", () => {
    const match = scoreGoogleMatch({
      queriedName: "Dolores Park",
      googleName: "Unrelated Bakery",
      queryLat: 37.76,
      queryLng: -122.42,
      googleLat: 37.8,
      googleLng: -122.4,
    });
    expect(match.confidence).toBe("weak");
  });
});
