import { describe, expect, it } from "vitest";
import type { GooglePlaceReview } from "./google-types";
import { skimGoogleReviews } from "./review-skim";

const sample: GooglePlaceReview[] = [
  {
    rating: 5,
    text: "Great",
    authorName: "A",
    publishTime: "2024-01-01T00:00:00Z",
  },
  {
    rating: 3,
    text: "Ok",
    authorName: "B",
    publishTime: "2025-06-01T00:00:00Z",
  },
  {
    rating: 4,
    text: "Good",
    authorName: "C",
    publishTime: "2023-01-01T00:00:00Z",
  },
];

describe("skimGoogleReviews", () => {
  it("keeps Places order for relevance", () => {
    const out = skimGoogleReviews(sample, { sort: "relevance" });
    expect(out.map((r) => r.authorName)).toEqual(["A", "B", "C"]);
  });

  it("filters by min stars without inventing reviews", () => {
    const out = skimGoogleReviews(sample, { minStars: 4 });
    expect(out).toHaveLength(2);
    expect(out.every((r) => (r.rating ?? 0) >= 4)).toBe(true);
  });

  it("sorts by rating and newest among the same five", () => {
    expect(
      skimGoogleReviews(sample, { sort: "rating" }).map((r) => r.rating),
    ).toEqual([5, 4, 3]);
    expect(
      skimGoogleReviews(sample, { sort: "newest" }).map((r) => r.authorName),
    ).toEqual(["B", "A", "C"]);
  });
});
