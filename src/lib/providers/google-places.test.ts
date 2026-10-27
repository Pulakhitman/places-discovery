import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getGooglePlaceDetails,
  isGooglePlacesConfigured,
  lookupGoogleForPlace,
  mapGooglePlaceDetails,
  searchGoogleNearby,
} from "./google-places";

describe("mapGooglePlaceDetails", () => {
  it("maps a Places API payload into display details", () => {
    const details = mapGooglePlaceDetails({
      id: "ChIJtest",
      displayName: { text: "Dolores Park" },
      formattedAddress: "Dolores St, SF",
      location: { latitude: 37.76, longitude: -122.43 },
      rating: 4.6,
      userRatingCount: 1200,
      regularOpeningHours: {
        weekdayDescriptions: ["Monday: Open 24 hours"],
      },
      reviews: [
        {
          rating: 5,
          text: { text: "Great park" },
          authorAttribution: { displayName: "Alex" },
          relativePublishTimeDescription: "2 weeks ago",
        },
      ],
      photos: [{ name: "places/ChIJtest/photos/abc", widthPx: 800 }],
    });

    expect(details?.name).toBe("Dolores Park");
    expect(details?.rating).toBe(4.6);
    expect(details?.reviews[0]?.text).toBe("Great park");
    expect(details?.photos[0]?.mediaUrl).toContain("/api/places/google/photo");
    expect(details?.attribution).toBe("Google Maps");
  });

  it("maps review attribution and report links", () => {
    const details = mapGooglePlaceDetails({
      id: "ChIJrev",
      displayName: { text: "Cafe" },
      location: { latitude: 1, longitude: 2 },
      reviews: [
        {
          rating: 4,
          text: { text: "Nice" },
          originalText: { text: "Bon" },
          authorAttribution: {
            displayName: "Sam",
            uri: "https://maps.google.com/contrib/1",
            photoUri: "https://example.com/a.jpg",
          },
          googleMapsUri: "https://maps.google.com/?cid=1",
          flagContentUri: "https://www.google.com/local/review/rap/report?postId=1",
          visitDateMonth: 3,
          visitDateYear: 2024,
        },
      ],
    });
    expect(details?.reviews[0]).toMatchObject({
      text: "Nice",
      originalText: "Bon",
      authorName: "Sam",
      authorUri: "https://maps.google.com/contrib/1",
      authorPhotoUri: "https://example.com/a.jpg",
      googleMapsUri: "https://maps.google.com/?cid=1",
      visitDateMonth: 3,
      visitDateYear: 2024,
    });
  });

  it("maps official reviewSummary verbatim", () => {
    const details = mapGooglePlaceDetails({
      id: "ChIJsum",
      displayName: { text: "Park" },
      location: { latitude: 1, longitude: 2 },
      reviewSummary: {
        text: { text: "People say this park is shady and quiet." },
        disclosureText: { text: "Summarized with Gemini" },
      },
    });
    expect(details?.reviewSummary).toEqual({
      text: "People say this park is shady and quiet.",
      disclosureText: "Summarized with Gemini",
    });
  });

  it("details field mask requests reviewSummary", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "ChIJ2",
        displayName: { text: "Cafe Roma" },
        location: { latitude: 1, longitude: 2 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await getGooglePlaceDetails("ChIJ2");
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<
      string,
      string
    >;
    expect(headers["X-Goog-FieldMask"]).toContain("reviewSummary");
    expect(headers["X-Goog-FieldMask"]).toContain("reviews");
  });

  it("returns null when required fields are missing", () => {
    expect(mapGooglePlaceDetails({ displayName: { text: "X" } })).toBeNull();
  });
});

describe("google places provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reports when API key is missing", () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");
    expect(isGooglePlacesConfigured()).toBe(false);
  });

  it("searches nearby with includedTypes and field mask", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        places: [
          {
            id: "ChIJ1",
            displayName: { text: "City Park" },
            location: { latitude: 37.77, longitude: -122.42 },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const places = await searchGoogleNearby({
      lat: 37.77,
      lng: -122.42,
      radiusM: 2000,
      category: "parks",
    });

    expect(places).toHaveLength(1);
    expect(places[0]?.name).toBe("City Park");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe(
      "test-key",
    );
    expect(
      (init.headers as Record<string, string>)["X-Goog-FieldMask"],
    ).toContain("places.displayName");
    const body = JSON.parse(String(init.body)) as {
      includedTypes: string[];
    };
    expect(body.includedTypes).toEqual(["park"]);
  });

  it("loads place details by id", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "ChIJ2",
        displayName: { text: "Cafe Roma" },
        location: { latitude: 1, longitude: 2 },
        rating: 4.2,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const details = await getGooglePlaceDetails("places/ChIJ2");
    expect(details?.placeId).toBe("ChIJ2");
    expect(details?.rating).toBe(4.2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/places/ChIJ2");
  });

  it("lookup skips unnamed places", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      lookupGoogleForPlace({
        name: "Unnamed park",
        lat: 1,
        lng: 2,
      }),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
