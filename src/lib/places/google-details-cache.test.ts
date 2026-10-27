import { describe, expect, it } from "vitest";
import {
  clearGoogleDetailsCache,
  getCachedGoogleDetails,
  setCachedGoogleDetails,
} from "./google-details-cache";
import type { GooglePlaceDetails } from "./google-types";

describe("google details cache", () => {
  it("does not retain review JSON or reviewSummary", () => {
    clearGoogleDetailsCache();
    const details: GooglePlaceDetails = {
      placeId: "ChIJcache",
      name: "Cafe",
      lat: 1,
      lng: 2,
      reviews: [{ rating: 5, text: "Secret review text" }],
      reviewSummary: {
        text: "Do not cache this summary",
        disclosureText: "Summarized with Gemini",
      },
      photos: [],
      attribution: "Google Maps",
    };
    setCachedGoogleDetails(details);
    const hit = getCachedGoogleDetails("ChIJcache");
    expect(hit?.reviews).toEqual([]);
    expect(hit?.reviewSummary).toBeUndefined();
    expect(hit?.name).toBe("Cafe");
    clearGoogleDetailsCache();
  });
});
