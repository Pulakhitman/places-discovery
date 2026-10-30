import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchOverture, OvertureError } from "./overture";

const temp = mkdtempSync(join(tmpdir(), "places-overture-"));
const file = join(temp, "test.sqlite");
const db = new DatabaseSync(file);
db.exec("CREATE TABLE metadata (release TEXT, bbox TEXT, row_count INTEGER)");
db.prepare("INSERT INTO metadata VALUES (?, ?, ?)").run("2026-10-21.0", "23,24,90,91", 3);
db.exec("CREATE TABLE places (id TEXT, name TEXT, lat REAL, lng REAL, taxonomy TEXT, hierarchy_json TEXT, basic_category TEXT, confidence REAL, operating_status TEXT, address TEXT, website TEXT, phone TEXT, sources_json TEXT)");
const insert = db.prepare("INSERT INTO places VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
insert.run("cafe", "One Café", 23.8, 90.4, "cafe", '["food_and_drink","cafe"]', "cafe", 0.8, "open", "Road 1", null, null, '[{"dataset":"Meta","license":"CDLA-Permissive-2.0"}]');
insert.run("far", "Far Café", 23.9, 90.5, "cafe", '["food_and_drink","cafe"]', "cafe", null, null, null, null, null, "[]");
insert.run("library", "A Library", 23.8, 90.4, "library", '["community","library"]', "library", null, null, null, null, null, "[]");
db.close();
const original = process.env.OVERTURE_DB_PATH;
beforeEach(() => { process.env.OVERTURE_DB_PATH = file; });

describe("local Overture snapshot", () => {
  it("filters taxonomy and true radius, preserving release and provenance", () => {
    const result = searchOverture({ lat: 23.8, lng: 90.4, radiusM: 1000, category: "cafes" });
    expect(result.release).toBe("2026-10-21.0");
    expect(result.places).toHaveLength(1);
    expect(result.places[0]?.overture?.sources).toEqual([{ dataset: "Meta", license: "CDLA-Permissive-2.0" }]);
  });
  it("supports bbox and parameterized custom keyword", () => {
    expect(searchOverture({ lat: 23.8, lng: 90.4, bbox: [23.79, 23.91, 90.39, 90.51], category: "cafes" }).places).toHaveLength(2);
    expect(searchOverture({ lat: 23.8, lng: 90.4, radiusM: 1000, category: "custom", customKeyword: "' OR 1=1 --" }).places).toHaveLength(0);
  });
  it("reports a missing import explicitly", () => {
    process.env.OVERTURE_DB_PATH = join(temp, "absent.sqlite");
    expect(() => searchOverture({ lat: 23.8, lng: 90.4, radiusM: 1000, category: "cafes" })).toThrow(OvertureError);
  });
});

afterAll(() => {
  process.env.OVERTURE_DB_PATH = original;
  rmSync(temp, { recursive: true, force: true });
});
