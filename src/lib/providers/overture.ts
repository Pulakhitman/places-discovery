import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { haversineMeters } from "@/lib/places/google-match";
import type { OsmPlace } from "@/lib/places/types";
import type { NominatimBBox, PlaceCategoryId } from "@/lib/search/categories";
import { categoryLabel } from "@/lib/search/overpass-queries";

export class OvertureError extends Error {
  constructor(message: string, public readonly kind: "unavailable" | "too_many" | "invalid") {
    super(message);
    this.name = "OvertureError";
  }
}

export const OVERTURE_ATTRIBUTION = "Overture Maps Foundation";
export const OVERTURE_LICENSE = "CDLA-Permissive-2.0 / Apache-2.0 (per source)";
export const MAX_OVERTURE_RESULTS = 20_000;

export function overtureConfigured(): boolean {
  const path = process.env.OVERTURE_DB_PATH?.trim();
  return Boolean(path && existsSync(path));
}

// Search the entire imported bounding box with no silent LIMIT. SQL category
// matching uses Overture's new taxonomy hierarchy, not the removed categories.
const CATEGORY_SQL: Record<Exclude<PlaceCategoryId, "custom">, string> = {
  parks: "(instr(hierarchy_json, '\"park\"') > 0 OR instr(hierarchy_json, '\"garden\"') > 0 OR basic_category IN ('park', 'garden'))",
  playgrounds: "(instr(hierarchy_json, '\"playground\"') > 0 OR basic_category = 'playground')",
  shops: "(instr(hierarchy_json, '\"shopping\"') > 0 OR instr(hierarchy_json, '\"shop\"') > 0 OR basic_category IN ('store', 'shop', 'market'))",
  supermarkets: "(instr(hierarchy_json, '\"supermarket\"') > 0 OR basic_category = 'supermarket')",
  cafes: "(instr(hierarchy_json, '\"cafe\"') > 0 OR basic_category = 'cafe')",
  restaurants: "(instr(hierarchy_json, '\"restaurant\"') > 0 OR basic_category IN ('restaurant', 'casual_eatery'))",
  libraries: "(instr(hierarchy_json, '\"library\"') > 0 OR basic_category = 'library')",
  schools: "(instr(hierarchy_json, '\"school\"') > 0 OR basic_category = 'school')",
};

type DbRow = {
  id: string; name: string; lat: number; lng: number;
  taxonomy: string | null; basic_category: string | null;
  confidence: number | null; operating_status: string | null;
  address: string | null; website: string | null; phone: string | null;
  sources_json: string;
};

type Source = { dataset: string; license: string | null };

function parseSources(value: string): Source[] {
  try {
    const items: unknown = JSON.parse(value);
    if (!Array.isArray(items)) return [];
    return items.flatMap((source): Source[] => {
      if (!source || typeof source !== "object") return [];
      const item = source as Record<string, unknown>;
      if (typeof item.dataset !== "string") return [];
      return [{ dataset: item.dataset, license: typeof item.license === "string" ? item.license : null }];
    });
  } catch {
    return [];
  }
}

export function searchOverture(params: {
  lat: number; lng: number; radiusM?: number; bbox?: NominatimBBox;
  category: PlaceCategoryId; customKeyword?: string;
}): { places: OsmPlace[]; release: string } {
  const path = process.env.OVERTURE_DB_PATH?.trim();
  if (!path || !existsSync(path)) {
    throw new OvertureError("Overture is not imported yet. Ask the operator to import a bounded region (see docs/overture.md).", "unavailable");
  }
  const db = new DatabaseSync(path, { readOnly: true, allowExtension: false });
  try {
    const meta = db.prepare("SELECT release FROM metadata LIMIT 1").get() as { release: string } | undefined;
    if (!meta) throw new OvertureError("Overture snapshot has no release metadata.", "invalid");
    const bbox = params.bbox ?? [
      params.lat - params.radiusM! / 111_320,
      params.lat + params.radiusM! / 111_320,
      params.lng - params.radiusM! / (111_320 * Math.max(0.01, Math.cos(params.lat * Math.PI / 180))),
      params.lng + params.radiusM! / (111_320 * Math.max(0.01, Math.cos(params.lat * Math.PI / 180))),
    ];
    const [south, north, west, east] = bbox;
    const where = ["lat BETWEEN ? AND ?", "lng BETWEEN ? AND ?"];
    const args: (number | string)[] = [south, north, west, east];
    if (params.category === "custom") {
      where.push("(instr(lower(name), lower(?)) > 0 OR instr(lower(coalesce(taxonomy, '')), lower(?)) > 0 OR instr(lower(coalesce(basic_category, '')), lower(?)) > 0)");
      args.push(params.customKeyword ?? "", params.customKeyword ?? "", params.customKeyword ?? "");
    } else {
      where.push(CATEGORY_SQL[params.category]);
    }
    // Query cap is an explicit error; do not claim a silently truncated result is complete.
    const sql = `SELECT id, name, lat, lng, taxonomy, basic_category, confidence, operating_status, address, website, phone, sources_json FROM places WHERE ${where.join(" AND ")} LIMIT ${MAX_OVERTURE_RESULTS + 1}`;
    const rows = db.prepare(sql).all(...args) as DbRow[];
    const matched = rows.filter((row) => params.bbox || haversineMeters(params.lat, params.lng, row.lat, row.lng) <= params.radiusM!);
    if (rows.length > MAX_OVERTURE_RESULTS) {
      throw new OvertureError(`More than ${MAX_OVERTURE_RESULTS} Overture bbox candidates found. Narrow the area or category; no partial results were returned.`, "too_many");
    }
    return {
      release: meta.release,
      places: matched.map((row) => ({
        id: `overture:${row.id}`,
        source: "overture" as const,
        overture: {
          id: row.id, release: meta.release, taxonomy: row.taxonomy,
          basicCategory: row.basic_category, confidence: row.confidence,
          operatingStatus: row.operating_status, sources: parseSources(row.sources_json),
        },
        name: row.name, isUnnamed: false,
        categoryId: params.category, categoryLabel: categoryLabel(params.category),
        lat: row.lat, lng: row.lng,
        distanceM: haversineMeters(params.lat, params.lng, row.lat, row.lng),
        address: row.address ?? undefined, website: row.website ?? undefined,
        phone: row.phone ?? undefined, tags: {}, sources: { overture: true as const },
      })).sort((a, b) => a.distanceM - b.distanceM),
    };
  } catch (err) {
    if (err instanceof OvertureError) throw err;
    throw new OvertureError("Overture snapshot could not be read. Re-import the region.", "invalid");
  } finally {
    db.close();
  }
}
