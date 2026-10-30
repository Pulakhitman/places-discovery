import { describe, expect, it } from "vitest";
import { overtureToExport, toOvertureExportRows } from "./export-overture";
import { toOsmExportRows } from "./export-osm";
import type { OsmPlace } from "./types";

const place: OsmPlace = {
  id: "overture:gers1", source: "overture", name: "Garden Café", isUnnamed: false,
  categoryId: "cafes", categoryLabel: "Cafés", lat: 23.8, lng: 90.4, distanceM: 200,
  address: "Dhaka", website: "https://example.org", tags: {}, sources: { overture: true },
  overture: {
    id: "gers1", release: "2026-10-21.0", taxonomy: "cafe", basicCategory: "cafe",
    confidence: 0.72, operatingStatus: "open",
    sources: [{ dataset: "Foursquare", license: "Apache-2.0" }],
  },
};
const google: OsmPlace = {
  ...place, id: "google:secret", source: "google", sources: { google: true },
  googlePlaceId: "secret", name: "Google secret", overture: undefined,
};
const osm: OsmPlace = {
  ...place, id: "osm:node/5", source: "osm", sources: { osm: true },
  osmId: 5, osmType: "node", overture: undefined, name: "OSM secret",
};

describe("Overture exports", () => {
  it("keeps only independently found Overture places and per-source provenance", () => {
    const rows = toOvertureExportRows([google, osm, place, { ...place, sources: { overture: true, google: true } }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "gers1", release: "2026-10-21.0", sources: [{ dataset: "Foursquare", license: "Apache-2.0" }] });
    expect(toOsmExportRows([place])).toEqual([]);
  });

  it("isolates CSV, JSON and GeoJSON from Google and OSM content", () => {
    for (const format of ["csv", "json", "geojson"] as const) {
      const file = overtureToExport([place, google, osm], format);
      expect(file.body).toContain("Garden Café");
      expect(file.body).toContain("Apache-2.0");
      expect(file.body).toContain("2026-10-21.0");
      expect(file.body).not.toContain("Google secret");
      expect(file.body).not.toContain("OSM secret");
      expect(file.body).not.toContain("google:secret");
    }
    const geojson = JSON.parse(overtureToExport([place], "geojson").body);
    expect(geojson.features[0].geometry.coordinates).toEqual([90.4, 23.8]);
  });
});
