import { describe, expect, it } from "vitest";
import {
  breadcrumbLabels,
  clearGeocodeLevel,
  invalidateChildren,
  mapFocusFromSelection,
  patchCountry,
  patchGeocodeLevel,
  pickFromResults,
  selectGeocodeLevel,
  setCountry,
  shouldAutoSelectFirstResult,
  skipLevel,
} from "./hierarchy";
import type { GeocodeResult, LocationSelection } from "./types";

const region: GeocodeResult = {
  id: "1",
  displayName: "California",
  lat: 36.7,
  lng: -119.4,
};

const county: GeocodeResult = {
  id: "2",
  displayName: "Los Angeles County",
  lat: 34.0,
  lng: -118.2,
};

const city: GeocodeResult = {
  id: "3",
  displayName: "Los Angeles",
  lat: 34.05,
  lng: -118.24,
};

function fullSelection(): LocationSelection {
  return {
    country: { code: "US", name: "United States of America" },
    region,
    county,
    city,
  };
}

describe("hierarchy invalidate / reset", () => {
  it("clears region, county, and city when country changes", () => {
    const next = setCountry(fullSelection(), {
      code: "BD",
      name: "Bangladesh",
    });
    expect(next.country?.code).toBe("BD");
    expect(next.region).toBeUndefined();
    expect(next.county).toBeUndefined();
    expect(next.city).toBeUndefined();
  });

  it("clears county and city when region changes", () => {
    const next = selectGeocodeLevel(fullSelection(), "region", {
      ...region,
      id: "99",
      displayName: "Texas",
    });
    expect(next.region?.displayName).toBe("Texas");
    expect(next.county).toBeUndefined();
    expect(next.city).toBeUndefined();
    expect(next.country?.code).toBe("US");
  });

  it("clears city when county changes", () => {
    const next = selectGeocodeLevel(fullSelection(), "county", {
      ...county,
      id: "88",
      displayName: "Orange County",
    });
    expect(next.county?.displayName).toBe("Orange County");
    expect(next.city).toBeUndefined();
    expect(next.region).toEqual(region);
  });

  it("invalidateChildren alone resets descendants without touching parent", () => {
    const next = invalidateChildren(fullSelection(), "region");
    expect(next.country).toEqual(fullSelection().country);
    expect(next.region).toEqual(region);
    expect(next.county).toBeUndefined();
    expect(next.city).toBeUndefined();
  });

  it("skipLevel clears the level and invalidates children", () => {
    const next = skipLevel(fullSelection(), "region");
    expect(next.region).toBeUndefined();
    expect(next.county).toBeUndefined();
    expect(next.city).toBeUndefined();
    expect(next.country?.code).toBe("US");
  });

  it("clearGeocodeLevel resets a mid-level and children", () => {
    const next = clearGeocodeLevel(fullSelection(), "county");
    expect(next.county).toBeUndefined();
    expect(next.city).toBeUndefined();
    expect(next.region).toEqual(region);
  });

  it("patchGeocodeLevel updates bbox without clearing children", () => {
    const next = patchGeocodeLevel(fullSelection(), "region", {
      ...region,
      lat: 37,
      lng: -120,
      boundingBox: [36, 38, -121, -119],
    });
    expect(next.region?.lat).toBe(37);
    expect(next.region?.boundingBox).toEqual([36, 38, -121, -119]);
    expect(next.county).toEqual(county);
    expect(next.city).toEqual(city);
  });

  it("patchGeocodeLevel ignores stale ids", () => {
    const next = patchGeocodeLevel(fullSelection(), "county", {
      ...county,
      id: "stale",
      boundingBox: [33, 35, -119, -117],
    });
    expect(next).toEqual(fullSelection());
  });

  it("patchCountry keeps region/county/city", () => {
    const next = patchCountry(fullSelection(), {
      code: "US",
      name: "United States of America",
      lat: 39,
      lng: -98,
      boundingBox: [24, 50, -125, -66],
    });
    expect(next.country?.lat).toBe(39);
    expect(next.region).toEqual(region);
    expect(next.county).toEqual(county);
    expect(next.city).toEqual(city);
  });

  it("builds breadcrumb from selected levels only", () => {
    expect(breadcrumbLabels(fullSelection())).toEqual([
      "United States of America",
      "California",
      "Los Angeles County",
      "Los Angeles",
    ]);
    expect(
      breadcrumbLabels({
        country: { code: "US", name: "United States of America" },
      }),
    ).toEqual(["United States of America"]);
  });
});

describe("mapFocusFromSelection", () => {
  it("zooms to country center when only country is selected", () => {
    const focus = mapFocusFromSelection({
      country: {
        code: "US",
        name: "United States of America",
        lat: 38,
        lng: -97,
      },
    });
    expect(focus.center).toEqual({ lat: 38, lng: -97 });
    expect(focus.zoom).toBe(5);
  });

  it("prefers city over country for focus", () => {
    const focus = mapFocusFromSelection({
      country: { code: "US", name: "United States of America", lat: 38, lng: -97 },
      city: {
        id: "3",
        displayName: "Los Angeles",
        lat: 34.05,
        lng: -118.24,
      },
    });
    expect(focus.center?.lat).toBe(34.05);
    expect(focus.zoom).toBe(12);
  });
});

describe("no auto-select first result", () => {
  it("never enables auto-select of the first geocode hit", () => {
    expect(shouldAutoSelectFirstResult()).toBe(false);
  });

  it("pickFromResults returns undefined when index is omitted", () => {
    const results = [region, county, city];
    expect(pickFromResults(results, undefined)).toBeUndefined();
    expect(pickFromResults(results, null)).toBeUndefined();
  });

  it("pickFromResults does not default to index 0", () => {
    const results = [region, county, city];
    expect(pickFromResults(results, undefined)?.id).not.toBe("1");
    expect(pickFromResults(results, 1)?.id).toBe("2");
  });

  it("pickFromResults rejects out-of-range indexes", () => {
    expect(pickFromResults([region], -1)).toBeUndefined();
    expect(pickFromResults([region], 1)).toBeUndefined();
    expect(pickFromResults([], 0)).toBeUndefined();
  });
});
