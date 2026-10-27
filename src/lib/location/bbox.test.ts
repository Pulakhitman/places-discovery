import { describe, expect, it } from "vitest";
import { isNominatimBBox } from "@/lib/search/categories";
import {
  bboxFromCenter,
  countyBoundsAreReliable,
  DIVISION_BBOX_RADIUS_KM,
  ensureBoundingBox,
  pointInNominatimBBox,
} from "./bbox";

describe("location bbox helpers", () => {
  it("builds a valid Nominatim-order box around a center", () => {
    const box = bboxFromCenter(23.79, 90.41, 10);
    expect(isNominatimBBox(box)).toBe(true);
    expect(box[0]).toBeLessThan(23.79);
    expect(box[1]).toBeGreaterThan(23.79);
    expect(box[2]).toBeLessThan(90.41);
    expect(box[3]).toBeGreaterThan(90.41);
  });

  it("fills a missing boundingBox on a CSC geocode result", () => {
    const enriched = ensureBoundingBox(
      {
        id: "city:BD::Dhaka",
        displayName: "Dhaka",
        lat: 23.81,
        lng: 90.41,
      },
      "city",
    );
    expect(isNominatimBBox(enriched.boundingBox)).toBe(true);
  });

  it("keeps an existing Nominatim boundingBox", () => {
    const existing: [number, number, number, number] = [23.7, 23.9, 90.3, 90.5];
    const enriched = ensureBoundingBox(
      {
        id: "1",
        displayName: "Dhaka",
        lat: 23.81,
        lng: 90.41,
        boundingBox: existing,
      },
      "city",
    );
    expect(enriched.boundingBox).toEqual(existing);
  });

  it("detects points inside a Nominatim bbox", () => {
    const box: [number, number, number, number] = [33.6, 34.4, -118.7, -118.1];
    expect(pointInNominatimBBox(34.05, -118.24, box)).toBe(true);
    expect(pointInNominatimBBox(37.77, -122.42, box)).toBe(false);
  });

  it("rejects synthetic county bounds that still sit on the region center", () => {
    const region = { lat: 36.7, lng: -119.4 };
    const synthetic = bboxFromCenter(
      region.lat,
      region.lng,
      DIVISION_BBOX_RADIUS_KM.county,
    );
    expect(
      countyBoundsAreReliable(
        { lat: region.lat, lng: region.lng, boundingBox: synthetic },
        region,
      ),
    ).toBe(false);
    expect(
      countyBoundsAreReliable(
        {
          lat: 34.05,
          lng: -118.24,
          boundingBox: [33.6, 34.4, -118.7, -118.1],
        },
        region,
      ),
    ).toBe(true);
  });
});
