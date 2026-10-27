import { describe, expect, it } from "vitest";
import {
  filterDivisions,
  getCitiesForSelection,
  getCountiesForRegion,
  getRegionsForCountry,
  hasStaticCountyList,
} from "./divisions";

describe("static division lists", () => {
  it("returns US regions including California", () => {
    const regions = getRegionsForCountry("US");
    expect(regions.length).toBeGreaterThan(50);
    expect(regions.some((r) => r.adminCode === "CA")).toBe(true);
  });

  it("returns California counties when region is set", () => {
    const counties = getCountiesForRegion("US", {
      displayName: "California",
      adminCode: "CA",
      lat: 36.7,
      lng: -119.4,
    });
    expect(counties.length).toBe(58);
    expect(counties[0]?.name).toMatch(/County$/);
  });

  it("returns no static counties outside the US", () => {
    expect(hasStaticCountyList("BD")).toBe(false);
    expect(
      getCountiesForRegion("BD", {
        displayName: "Dhaka Division",
        adminCode: "13",
        lat: 23.8,
        lng: 90.4,
      }),
    ).toEqual([]);
  });

  it("returns cities for a US state", () => {
    const cities = getCitiesForSelection("US", { adminCode: "CA" });
    expect(cities.length).toBeGreaterThan(100);
  });

  it("filters divisions without inventing a selection", () => {
    const options = getRegionsForCountry("US");
    const filtered = filterDivisions("calif", options);
    expect(filtered.every((o) => /calif/i.test(o.name))).toBe(true);
    expect(filtered[0]).toBeDefined();
  });
});
