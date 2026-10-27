/**
 * Phase 5 — local skim/filter of the same ≤5 Google reviews.
 * No extra API calls; never invents reviews.
 */

import type { GooglePlaceReview } from "./google-types";

export type ReviewSkimSort = "relevance" | "rating" | "newest";
export type ReviewSkimMinStars = 0 | 4 | 5;

export function skimGoogleReviews(
  reviews: GooglePlaceReview[],
  options: {
    minStars?: ReviewSkimMinStars;
    sort?: ReviewSkimSort;
  } = {},
): GooglePlaceReview[] {
  const minStars = options.minStars ?? 0;
  const sort = options.sort ?? "relevance";

  let next = reviews.filter((r) =>
    minStars === 0
      ? true
      : typeof r.rating === "number" && r.rating >= minStars,
  );

  if (sort === "rating") {
    next = [...next].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (sort === "newest") {
    next = [...next].sort((a, b) => {
      const ta = a.publishTime ? Date.parse(a.publishTime) : 0;
      const tb = b.publishTime ? Date.parse(b.publishTime) : 0;
      return tb - ta;
    });
  }
  // "relevance" keeps Places API order

  return next;
}
