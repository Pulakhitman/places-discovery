import type { OsmPlace } from "./types";

export type OvertureExportRow = {
  id: string; release: string; name: string; categoryId: string;
  lat: number; lng: number; distanceM: number; address: string;
  website: string; phone: string; taxonomy: string; basicCategory: string;
  confidence: number | null; operatingStatus: string;
  sources: { dataset: string; license: string | null }[];
};

/** Strict allowlist; source data is never filled from OSM, Google or enrichment. */
export function toOvertureExportRows(places: OsmPlace[]): OvertureExportRow[] {
  return places.filter((p) =>
    p.source === "overture" && p.sources.overture === true &&
    !p.sources.google && !p.sources.osm && !p.googlePlaceId && !p.osmId &&
    Boolean(p.overture?.id && p.overture.release) && p.id === `overture:${p.overture?.id}`,
  ).map((p) => ({
    id: p.overture!.id,
    release: p.overture!.release,
    name: p.name,
    categoryId: p.categoryId,
    lat: p.lat,
    lng: p.lng,
    distanceM: p.distanceM,
    address: p.address ?? "",
    website: p.website ?? "",
    phone: p.phone ?? "",
    taxonomy: p.overture!.taxonomy ?? "",
    basicCategory: p.overture!.basicCategory ?? "",
    confidence: p.overture!.confidence,
    operatingStatus: p.overture!.operatingStatus ?? "",
    sources: p.overture!.sources.map((source) => ({ dataset: source.dataset, license: source.license })),
  }));
}

export type OvertureFormat = "csv" | "json" | "geojson";
const COLUMNS: (keyof OvertureExportRow)[] = [
  "id", "release", "name", "categoryId", "lat", "lng", "distanceM", "address", "website", "phone",
  "taxonomy", "basicCategory", "confidence", "operatingStatus", "sources",
];
const ATTRIBUTION = "Overture Maps Foundation; see sources and per-source license on every row";

function csvCell(value: unknown): string {
  const text = typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function overtureToExport(places: OsmPlace[], format: OvertureFormat) {
  const rows = toOvertureExportRows(places);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const meta = {
    attribution: ATTRIBUTION,
    licenses: "CDLA-Permissive-2.0 / Apache-2.0 / CC0-1.0 (check each row's source licenses)",
    release: [...new Set(rows.map((r) => r.release))],
    note: "Overture Places only; Google, Foursquare API, BestTime and OSM fields excluded. Imported-region coverage only; no completeness guarantee.",
    exportedAt: new Date().toISOString(),
    placeCount: rows.length,
  };
  if (format === "csv") {
    return {
      filename: `places-overture-${stamp}.csv`, mime: "text/csv;charset=utf-8",
      body: `# ${ATTRIBUTION}\n# ${meta.licenses}\n# ${meta.note}\n${COLUMNS.join(",")}\n${rows.map((row) => COLUMNS.map((key) => csvCell(row[key])).join(",")).join("\n")}\n`,
    };
  }
  if (format === "geojson") {
    return {
      filename: `places-overture-${stamp}.geojson`, mime: "application/geo+json;charset=utf-8",
      body: `${JSON.stringify({ type: "FeatureCollection", meta, features: rows.map(({ lat, lng, ...properties }) => ({
        type: "Feature", id: properties.id, geometry: { type: "Point", coordinates: [lng, lat] }, properties,
      })) }, null, 2)}\n`,
    };
  }
  return {
    filename: `places-overture-${stamp}.json`, mime: "application/json;charset=utf-8",
    body: `${JSON.stringify({ meta, places: rows }, null, 2)}\n`,
  };
}
