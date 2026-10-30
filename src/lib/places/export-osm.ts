import { computeOsmCoverage } from "./coverage";
import type { OsmPlace } from "./types";

/** Flat OSM-only row for exports. Never include Google fields. */
export type OsmExportRow = {
  id: string;
  name: string;
  named: boolean;
  category: string;
  categoryId: string;
  lat: number;
  lng: number;
  distanceM: number;
  address: string;
  hours: string;
  website: string;
  phone: string;
  osmType: string;
  osmId: number;
};

export type OsmExportMeta = {
  exportedAt: string;
  placeCount: number;
  attribution: string;
  license: string;
  note: string;
};

const EXPORT_NOTE =
  "OpenStreetMap data only. Google Places content is display-only and is never exported.";

const CSV_COLUMNS: (keyof OsmExportRow)[] = [
  "id",
  "name",
  "named",
  "category",
  "categoryId",
  "lat",
  "lng",
  "distanceM",
  "address",
  "hours",
  "website",
  "phone",
  "osmType",
  "osmId",
];

/**
 * Flat OSM-only row for exports. Google rows (even with matched OSM snapshots)
 * never select export records; only independently returned OSM rows count.
 */
export function toOsmExportRows(places: OsmPlace[]): OsmExportRow[] {
  return places
    .filter(
      (p): p is OsmPlace & { osmType: string; osmId: number } =>
        p.source === "osm" &&
        p.sources.osm === true &&
        p.sources.google !== true &&
        p.googlePlaceId === undefined &&
        p.overture === undefined &&
        p.sources.overture !== true &&
        typeof p.osmType === "string" &&
        typeof p.osmId === "number" &&
        p.id === `osm:${p.osmType}/${p.osmId}`,
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      named: !p.isUnnamed,
      category: p.categoryLabel,
      categoryId: p.categoryId,
      lat: p.lat,
      lng: p.lng,
      distanceM: p.distanceM,
      address: p.address ?? "",
      hours: p.hours ?? "",
      website: p.website ?? "",
      phone: p.phone ?? "",
      osmType: p.osmType,
      osmId: p.osmId,
    }));
}

export function buildExportMeta(placeCount: number): OsmExportMeta {
  return {
    exportedAt: new Date().toISOString(),
    placeCount,
    attribution: "© OpenStreetMap contributors",
    license: "ODbL",
    note: EXPORT_NOTE,
  };
}

function csvEscape(value: string | number | boolean): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** CSV of OSM fields only (+ attribution comment lines). */
export function placesToCsv(places: OsmPlace[]): string {
  const rows = toOsmExportRows(places);
  const meta = buildExportMeta(rows.length);
  const header = CSV_COLUMNS.join(",");
  const body = rows
    .map((row) => CSV_COLUMNS.map((col) => csvEscape(row[col])).join(","))
    .join("\n");
  const comments = [
    `# ${meta.attribution} (${meta.license})`,
    `# ${meta.note}`,
    `# exportedAt=${meta.exportedAt}`,
    `# placeCount=${meta.placeCount}`,
  ].join("\n");
  return `${comments}\n${header}\n${body}\n`;
}

/** JSON document with OSM rows + meta. No Google keys. */
export function placesToJson(places: OsmPlace[]): string {
  const rows = toOsmExportRows(places);
  return `${JSON.stringify(
    {
      meta: buildExportMeta(rows.length),
      places: rows,
    },
    null,
    2,
  )}\n`;
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Standalone HTML report of OSM fields for print / archive. */
export function placesToHtml(places: OsmPlace[]): string {
  const rows = toOsmExportRows(places);
  const meta = buildExportMeta(rows.length);
  const coverage = computeOsmCoverage(places.filter((row) => row.source === "osm"));
  const headCells = CSV_COLUMNS.map(
    (col) => `<th>${htmlEscape(col)}</th>`,
  ).join("");
  const bodyRows = rows
    .map((row) => {
      const cells = CSV_COLUMNS.map(
        (col) => `<td>${htmlEscape(String(row[col]))}</td>`,
      ).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("\n");

  const coverageRows = [
    ["Named", coverage.withNamed, coverage.namedPct],
    ["Hours", coverage.withHours, coverage.hoursPct],
    ["Website", coverage.withWebsite, coverage.websitePct],
    ["Phone", coverage.withPhone, coverage.phonePct],
    ["Address", coverage.withAddress, coverage.addressPct],
  ]
    .map(
      ([label, count, pct]) =>
        `<tr><td>${htmlEscape(String(label))}</td><td>${count}/${coverage.total}</td><td>${pct}%</td></tr>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Places Discovery OSM report (${meta.placeCount})</title>
<style>
  :root { color-scheme: light; }
  body { font-family: "Source Sans 3", system-ui, sans-serif; margin: 1.5rem; color: #1c1914; background: #f3efe6; }
  main { max-width: 960px; margin: 0 auto; background: #fffdf8; border: 1px solid #d4cbb8; border-radius: 12px; padding: 1.25rem 1.5rem; }
  h1 { font-size: 1.35rem; margin: 0 0 0.35rem; }
  h2 { font-size: 1rem; margin: 1.25rem 0 0.5rem; }
  .muted { color: #5c564c; font-size: 0.875rem; line-height: 1.45; }
  .disclaimer { border: 1px solid #d4cbb8; background: #ebe4d6; border-radius: 8px; padding: 0.75rem 1rem; margin: 1rem 0; font-size: 0.85rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.8rem; background: #fff; }
  th, td { border: 1px solid #d4cbb8; padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
  th { background: #ebe4d6; }
  @media print {
    body { background: white; margin: 0; }
    main { border: none; border-radius: 0; padding: 0; max-width: none; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
<main>
<h1>Places Discovery — OpenStreetMap report</h1>
<p class="muted">Exported ${htmlEscape(meta.exportedAt)} · ${meta.placeCount} place(s)</p>
<div class="disclaimer" role="note">
  <strong>Disclaimer:</strong> ${htmlEscape(meta.note)}
  Empty cells mean the tag was missing in OSM at export time — not an app error.
  Do not treat this file as Google Places data.
</div>
<p class="muted">${htmlEscape(meta.attribution)} (${htmlEscape(meta.license)}).</p>
<h2>Field coverage</h2>
<table>
<thead><tr><th>Field</th><th>Count</th><th>Share</th></tr></thead>
<tbody>
${coverageRows}
</tbody>
</table>
<h2>Places</h2>
<table>
<thead><tr>${headCells}</tr></thead>
<tbody>
${bodyRows}
</tbody>
</table>
<p class="muted no-print">Tip: use your browser’s Print dialog for a paper or PDF copy.</p>
</main>
</body>
</html>
`;
}

export function placesToGeoJson(places: OsmPlace[]): string {
  const rows = toOsmExportRows(places);
  return `${JSON.stringify({
    type: "FeatureCollection",
    meta: buildExportMeta(rows.length),
    features: rows.map(({ lat, lng, ...properties }) => ({
      type: "Feature",
      id: properties.id,
      geometry: { type: "Point", coordinates: [lng, lat] },
      properties,
    })),
  }, null, 2)}\n`;
}

export type ExportFormat = "csv" | "json" | "html" | "geojson";

export function placesToExport(
  places: OsmPlace[],
  format: ExportFormat,
): { filename: string; mime: string; body: string } {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  switch (format) {
    case "csv":
      return {
        filename: `places-osm-${stamp}.csv`,
        mime: "text/csv;charset=utf-8",
        body: placesToCsv(places),
      };
    case "json":
      return {
        filename: `places-osm-${stamp}.json`,
        mime: "application/json;charset=utf-8",
        body: placesToJson(places),
      };
    case "html":
      return {
        filename: `places-osm-${stamp}.html`,
        mime: "text/html;charset=utf-8",
        body: placesToHtml(places),
      };
    case "geojson":
      return {
        filename: `places-osm-${stamp}.geojson`,
        mime: "application/geo+json;charset=utf-8",
        body: placesToGeoJson(places),
      };
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}
