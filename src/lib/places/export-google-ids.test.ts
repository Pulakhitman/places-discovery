import { describe, expect, it } from "vitest";
import type { OsmPlace } from "./types";
import { googleIdsToExport, toGooglePlaceIds } from "./export-google-ids";

const osm: OsmPlace = {
  id: "osm:node/1", source: "osm", osmType: "node", osmId: 1,
  name: "OSM private name", isUnnamed: false, categoryId: "cafes",
  categoryLabel: "Cafes", lat: 1, lng: 2, distanceM: 10,
  tags: { name: "OSM private name" }, sources: { osm: true },
};
const google: OsmPlace = {
  id: "google:ChIJexample", source: "google", googlePlaceId: "ChIJexample",
  name: "Google private name", address: "Google private address",
  isUnnamed: false, categoryId: "cafes", categoryLabel: "Cafes",
  lat: 3, lng: 4, distanceM: 15, tags: {}, sources: { google: true },
};

describe("Google Place ID exports", () => {
  it("exports only unique IDs from Google rows, including merged rows", () => {
    const merged = { ...google, sources: { google: true as const, osm: true as const }, matchedOsm: osm };
    const places = [osm, google, merged, { ...google, id: "google:fake" }];
    expect(toGooglePlaceIds(places)).toEqual(["ChIJexample"]);
    const csv = googleIdsToExport(places, "csv");
    expect(csv.filename).toMatch(/^places-google-ids-.*\.csv$/);
    expect(csv.body).toBe('place_id\n"ChIJexample"\n');
    const json = googleIdsToExport(places, "json");
    expect(JSON.parse(json.body)).toEqual({ placeIds: ["ChIJexample"] });
    for (const body of [csv.body, json.body]) {
      expect(body).not.toMatch(/private name|private address|osm:node|lat|rating|review/i);
    }
  });

  it("does not expose an OSM row with a spoofed Google ID", () => {
    expect(toGooglePlaceIds([{ ...osm, googlePlaceId: "ChIJfake" }])).toEqual([]);
  });
});
