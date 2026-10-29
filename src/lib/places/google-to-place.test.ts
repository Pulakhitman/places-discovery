import { describe, expect, it } from "vitest";
import { googleDetailsToPlace, mergePlaceSources } from "./google-to-place";
import { toOsmExportRows } from "./export-osm";
import type { GooglePlaceDetails } from "./google-types";
import type { OsmPlace } from "./types";

function details(partial: Partial<GooglePlaceDetails> = {}): GooglePlaceDetails {
  return {
    placeId: "ChIJtest",
    name: "Cafe Roma",
    lat: 1,
    lng: 2,
    reviews: [],
    attribution: "Google Maps",
    ...partial,
  };
}

function osmPlace(partial: Partial<OsmPlace> & Pick<OsmPlace, "id" | "name">): OsmPlace {
  return {
    source: "osm",
    osmType: "node",
    osmId: 1,
    isUnnamed: false,
    categoryId: "cafes",
    categoryLabel: "Cafes",
    lat: 1,
    lng: 2,
    distanceM: 10,
    tags: {},
    sources: { osm: true },
    ...partial,
  };
}

describe("googleDetailsToPlace", () => {
  it("maps Google details into a display-only result row", () => {
    const place = googleDetailsToPlace(
      details({
        address: "12 Main St",
        website: "https://cafe.test",
        phone: "555-0100",
        hoursWeekday: ["Monday: 9 AM–5 PM"],
      }),
      {
        center: { lat: 1, lng: 2 },
        categoryId: "cafes",
        categoryLabel: "Cafes",
      },
    );

    expect(place).toMatchObject({
      id: "google:ChIJtest",
      source: "google",
      googlePlaceId: "ChIJtest",
      name: "Cafe Roma",
      isUnnamed: false,
      address: "12 Main St",
      website: "https://cafe.test",
      phone: "555-0100",
      hours: "Monday: 9 AM–5 PM",
      sources: { google: true },
    });
    // OSM identity must stay absent so exports can't pick it up.
    expect(place.osmType).toBeUndefined();
    expect(place.osmId).toBeUndefined();
  });

  it("prefers current (holiday-aware) hours when present", () => {
    const place = googleDetailsToPlace(
      details({
        hoursWeekday: ["Monday: 9 AM–5 PM"],
        attributes: { currentHoursWeekday: ["Monday: Closed"] },
      }),
      { center: { lat: 1, lng: 2 }, categoryId: "cafes", categoryLabel: "Cafes" },
    );
    expect(place.hours).toBe("Monday: Closed");
  });
});

describe("mergePlaceSources", () => {
  it("attaches the original OSM row to a nearby Google result without mixing fields", () => {
    const google = [
      googleDetailsToPlace(details(), {
        center: { lat: 1, lng: 2 },
        categoryId: "cafes",
        categoryLabel: "Cafes",
      }),
    ];
    const osm = [
      osmPlace({ id: "osm:node/1", name: "Cafe Roma", lat: 1.00005, lng: 2 }),
      osmPlace({
        id: "osm:node/2",
        name: "Corner Bakery",
        lat: 1.01,
        lng: 2.01,
        osmId: 2,
      }),
    ];

    const merged = mergePlaceSources(google, osm);
    expect(merged.map((p) => p.id)).toEqual(["google:ChIJtest", "osm:node/2"]);
    expect(merged[0].matchedOsm?.id).toBe("osm:node/1");
    expect(merged[0].sources).toEqual({ google: true, osm: true });
    expect(merged[0].matchedOsm?.sources).toEqual({ osm: true });
    expect(merged[0].matchedOsm?.googlePlaceId).toBeUndefined();
    expect(merged[0].source).toBe("google");
    expect(merged[0].osmId).toBeUndefined();
    expect(toOsmExportRows(merged).map((row) => row.id)).toEqual(["osm:node/1", "osm:node/2"]);
  });

  it("keeps ambiguous nearby OSM matches separate rather than attributing provider data", () => {
    const google = [googleDetailsToPlace(details(), {
      center: { lat: 1, lng: 2 }, categoryId: "cafes", categoryLabel: "Cafes",
    })];
    const osm = [
      osmPlace({ id: "osm:node/1", name: "Cafe Roma" }),
      osmPlace({ id: "osm:node/2", osmId: 2, name: "Cafe Roma" }),
    ];
    const merged = mergePlaceSources(google, osm);
    expect(merged).toHaveLength(3);
    expect(merged[0].matchedOsm).toBeUndefined();
  });

  it("keeps an OSM row separate when two Google results could claim it", () => {
    const google = ["ChIJone", "ChIJtwo"].map((placeId) =>
      googleDetailsToPlace(details({ placeId }), {
        center: { lat: 1, lng: 2 }, categoryId: "cafes", categoryLabel: "Cafes",
      }),
    );
    const osm = [osmPlace({ id: "osm:node/1", name: "Cafe Roma" })];
    const merged = mergePlaceSources(google, osm);
    expect(merged).toHaveLength(3);
    expect(merged.every((p) => !p.matchedOsm)).toBe(true);
    expect(toOsmExportRows(merged)).toHaveLength(1);
  });

  it("keeps distant OSM rows with a similar name", () => {
    const google = [
      googleDetailsToPlace(details(), {
        center: { lat: 1, lng: 2 },
        categoryId: "cafes",
        categoryLabel: "Cafes",
      }),
    ];
    const osm = [osmPlace({ id: "osm:far", name: "Cafe Roma", lat: 1.05, lng: 2 })];
    expect(mergePlaceSources(google, osm)).toHaveLength(2);
  });
});
