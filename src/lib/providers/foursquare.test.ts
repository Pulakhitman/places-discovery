import { afterEach, describe, expect, it, vi } from "vitest";
import { getFoursquarePremium, mapFoursquarePlace, matchFoursquareResults, PREMIUM_FIELDS, safeFoursquareUrl, searchFoursquare, validateFoursquareInput } from "./foursquare";

const base = { fsq_place_id: "abcdef1234567890", name: "Coffee House", latitude: 40, longitude: -73 };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Foursquare 2025 official API", () => {
  it("bounds inputs and never accepts untrusted URLs", () => {
    expect(validateFoursquareInput({ name: "Cafe", lat: 0, lng: 180 })).toEqual({ name: "Cafe", lat: 0, lng: 180 });
    expect(validateFoursquareInput({ name: "Cafe", lat: "0", lng: 0 })).toBeNull();
    expect(validateFoursquareInput({ name: "x".repeat(121), lat: 0, lng: 0 })).toBeNull();
    expect(safeFoursquareUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeFoursquareUrl("https://user:pass@example.com")).toBeUndefined();
  });

  it("allowlists Pro and Premium mapping and strips photos", () => {
    const mapped = mapFoursquarePlace({ ...base, photos: [{ prefix: "private" }], link: "javascript:bad", categories: [{ name: "Cafe" }], chains: [{ name: "Chain" }], social_media: { instagram: "coffee" }, location: { formatted_address: "1 Main St" }, rating: 8.5, popularity: 0.7, hours_popular: [{ day: 1, open: "09:00", close: "13:00" }], attributes: { wifi: "free", delivery: true }, tips: [{ text: "Nice" }], stats: { total_photos: 4 } });
    expect(mapped).toMatchObject({ id: base.fsq_place_id, address: "1 Main St", categories: ["Cafe"], chains: ["Chain"], rating: 8.5, popularity: 0.7, popularWindows: [{ day: 1, open: "09:00", close: "13:00" }], tags: ["wifi: free", "delivery"], tips: ["Nice"], stats: { photos: 4 } });
    expect(mapped?.link).toMatch(/^https:\/\/foursquare.com/);
    expect(JSON.stringify(mapped)).not.toContain("private");
    expect(PREMIUM_FIELDS.split(",")).not.toContain("photos");
  });

  it("rejects distant or dissimilar candidates and requires confirmation for weak matches", () => {
    const input = { name: "Coffee House", lat: 40, lng: -73 };
    expect(matchFoursquareResults([{ ...base, latitude: 40.01 }], input)).toBeNull();
    expect(matchFoursquareResults([{ ...base, name: "Unrelated" }], input)).toBeNull();
    expect(matchFoursquareResults([base], input)?.confidence).toBe("strong");
    expect(matchFoursquareResults([{ ...base, latitude: 40.001 }], input)?.confidence).toBe("weak");
  });

  it("searches Pro only; fetches Premium fields on separate explicit call", async () => {
    vi.stubEnv("FOURSQUARE_SERVICE_KEY", "test-key");
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ results: [base] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ ...base, rating: 8 }) });
    vi.stubGlobal("fetch", fetcher);
    const match = await searchFoursquare({ name: "Coffee House", lat: 40, lng: -73 });
    expect(match?.place.name).toBe("Coffee House");
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [searchUrl, options] = fetcher.mock.calls[0];
    expect(String(searchUrl)).toContain("radius=400&limit=5");
    expect(String(searchUrl)).not.toContain("fields=");
    expect(options.headers.Authorization).toBe("Bearer test-key");
    expect(options.headers["X-Places-Api-Version"]).toBe("2025-06-17");
    expect(options.cache).toBe("no-store");
    await getFoursquarePremium(match!);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1][0])).toContain("fields=");
  });
});
