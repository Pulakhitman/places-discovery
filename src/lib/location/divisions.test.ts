import { describe, expect, it } from "vitest";
import { enrichGeocodeBoundingBox } from "./enrich-bbox";
import { getCountiesForRegion, toGeocodeResult } from "./divisions";

describe("getCountiesForRegion", () => {
  it("lists California counties from CSC short state name", () => {
    const counties = getCountiesForRegion("US", {
      displayName: "California",
      adminCode: "CA",
      lat: 36.7,
      lng: -119.4,
    });
    expect(counties.length).toBeGreaterThan(50);
    expect(counties.some((c) => c.name === "Los Angeles County")).toBe(true);
  });

  it("still lists counties when displayName was Nominatim-enriched", () => {
    const counties = getCountiesForRegion("US", {
      displayName: "California, United States",
      adminCode: "CA",
      lat: 36.7,
      lng: -119.4,
    });
    expect(counties.length).toBeGreaterThan(50);
    expect(counties.some((c) => c.name.includes("Los Angeles"))).toBe(true);
  });

  it("resolves counties from adminCode alone", () => {
    const counties = getCountiesForRegion("US", {
      displayName: "",
      adminCode: "TX",
      lat: 31,
      lng: -100,
    });
    expect(counties.length).toBeGreaterThan(50);
  });
});

describe("toGeocodeResult + enrich preserve short names", () => {
  it("keeps CSC displayName when Nominatim returns a longer label", async () => {
    const original = toGeocodeResult(
      {
        id: "state:US:CA",
        name: "California",
        adminCode: "CA",
        lat: 36.7,
        lng: -119.4,
      },
      "region",
    );

    const fetchMock = async () =>
      ({
        ok: true,
        json: async () => ({
          status: "ok",
          results: [
            {
              id: "nom-1",
              displayName: "California, United States",
              lat: 37.2,
              lng: -119.5,
              boundingBox: [32.5, 42.0, -124.5, -114.1],
            },
          ],
        }),
      }) as Response;

    const prev = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const enriched = await enrichGeocodeBoundingBox({
        result: original,
        level: "region",
        countryCode: "US",
      });
      expect(enriched.displayName).toBe("California");
      expect(enriched.adminCode).toBe("CA");
      expect(enriched.boundingBox).toEqual([32.5, 42.0, -124.5, -114.1]);
      const counties = getCountiesForRegion("US", enriched);
      expect(counties.some((c) => c.name === "Los Angeles County")).toBe(true);
    } finally {
      globalThis.fetch = prev;
    }
  });
});
