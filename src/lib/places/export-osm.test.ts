import { describe, expect, it } from "vitest";
import {
  placesToCsv,
  placesToExport,
  placesToHtml,
  placesToJson,
  toOsmExportRows,
} from "./export-osm";
import type { OsmPlace } from "./types";

const sample: OsmPlace = {
  id: "osm:node/1",
  source: "osm",
  osmType: "node",
  osmId: 1,
  name: "Dolores Park",
  isUnnamed: false,
  categoryId: "parks",
  categoryLabel: "Parks & gardens",
  lat: 37.76,
  lng: -122.43,
  distanceM: 120,
  address: "Dolores St",
  hours: "Mo-Su 06:00-22:00",
  website: "https://example.org",
  phone: "+1 555",
  tags: { name: "Dolores Park" },
  sources: { osm: true },
};

describe("OSM exports", () => {
  it("maps OSM rows without Google fields", () => {
    const rows = toOsmExportRows([sample]);
    expect(rows[0]?.name).toBe("Dolores Park");
    expect(JSON.stringify(rows)).not.toMatch(/google|rating|review/i);
  });

  it("drops Google-sourced rows from every export format", () => {
    const googleRow: OsmPlace = {
      id: "google:ChIJx",
      source: "google",
      googlePlaceId: "ChIJx",
      name: "Google Only Cafe",
      isUnnamed: false,
      categoryId: "cafes",
      categoryLabel: "Cafes",
      lat: 1,
      lng: 2,
      distanceM: 40,
      tags: {},
      sources: { google: true },
    };

    expect(toOsmExportRows([sample, googleRow])).toHaveLength(1);
    for (const body of [
      placesToCsv([sample, googleRow]),
      placesToJson([sample, googleRow]),
      placesToHtml([sample, googleRow]),
    ]) {
      expect(body).not.toContain("Google Only Cafe");
    }
  });

  it("exports only the original OSM snapshot from a merged Google result", () => {
    const merged: OsmPlace = {
      ...sample,
      id: "google:ChIJsecret",
      source: "google",
      googlePlaceId: "ChIJsecret",
      osmType: undefined,
      osmId: undefined,
      name: "Google-only name",
      address: "Google-only address",
      website: "https://google.test",
      sources: { google: true, osm: true },
      matchedOsm: sample,
    };
    const rows = toOsmExportRows([merged]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: sample.id, name: sample.name, address: sample.address });
    for (const body of [placesToCsv([merged]), placesToJson([merged]), placesToHtml([merged])]) {
      expect(body).not.toMatch(/Google-only name|Google-only address|google\.test|ChIJsecret/);
    }
    expect(toOsmExportRows([{ ...merged, matchedOsm: { ...sample, sources: { osm: true, google: true } } }])).toHaveLength(0);
  });

  it("builds CSV with attribution comments", () => {
    const csv = placesToCsv([sample]);
    expect(csv).toContain("OpenStreetMap");
    expect(csv).toContain("never exported");
    expect(csv).toContain("Dolores Park");
    // Data rows must not include rating columns (note may mention Google exclusion).
    const dataLines = csv.split("\n").filter((l) => l && !l.startsWith("#"));
    expect(dataLines.join("\n")).not.toMatch(/rating/i);
  });

  it("builds JSON with meta note", () => {
    const json = placesToJson([sample]);
    const parsed = JSON.parse(json) as {
      meta: { note: string };
      places: unknown[];
    };
    expect(parsed.places).toHaveLength(1);
    expect(parsed.meta.note).toMatch(/Google Places content is display-only/i);
    expect(json).not.toMatch(/"rating"/);
  });

  it("builds HTML report with coverage and disclaimer", () => {
    const html = placesToHtml([sample]);
    expect(html).toContain("<table>");
    expect(html).toContain("Dolores Park");
    expect(html).toContain("ODbL");
    expect(html).toContain("Field coverage");
    expect(html).toContain("Disclaimer");
    expect(html).toContain("@media print");
    expect(html).not.toMatch(/"rating"/);
  });

  it("picks mime and filename per format", () => {
    expect(placesToExport([sample], "csv").mime).toContain("csv");
    expect(placesToExport([sample], "json").filename).toMatch(/\.json$/);
    expect(placesToExport([sample], "html").body).toContain("<!DOCTYPE html>");
  });
});
