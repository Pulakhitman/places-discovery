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

export function toOsmExportRows(places: OsmPlace[]): OsmExportRow[] {
  return places.map((p) => ({
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

/** Standalone HTML table of OSM fields for print / archive. */
export function placesToHtml(places: OsmPlace[]): string {
  const rows = toOsmExportRows(places);
  const meta = buildExportMeta(rows.length);
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Places Discovery export (${meta.placeCount})</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 1.5rem; color: #1c1914; }
  h1 { font-size: 1.25rem; }
  p { color: #5c564c; font-size: 0.875rem; }
  table { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
  th, td { border: 1px solid #d4cbb8; padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
  th { background: #ebe4d6; }
</style>
</head>
<body>
<h1>Places Discovery — OSM export</h1>
<p>${htmlEscape(meta.attribution)} (${htmlEscape(meta.license)}). ${htmlEscape(meta.note)}</p>
<p>Exported ${htmlEscape(meta.exportedAt)} · ${meta.placeCount} place(s)</p>
<table>
<thead><tr>${headCells}</tr></thead>
<tbody>
${bodyRows}
</tbody>
</table>
</body>
</html>
`;
}

export type ExportFormat = "csv" | "json" | "html";

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
    default: {
      const _exhaustive: never = format;
      return _exhaustive;
    }
  }
}
