import { describe, expect, it } from "vitest";
import { computeOsmCoverage } from "./coverage";
import { parseOverpassElements, type OverpassElement } from "./parse-overpass";

const center = { lat: 37.77, lng: -122.42 };

describe("parseOverpassElements", () => {
  it("maps tags to place fields and sorts by distance", () => {
    const elements: OverpassElement[] = [
      {
        type: "node",
        id: 2,
        lat: 37.78,
        lon: -122.42,
        tags: {
          name: "Far Park",
          opening_hours: "Mo-Su 08:00-18:00",
        },
      },
      {
        type: "node",
        id: 1,
        lat: 37.771,
        lon: -122.42,
        tags: {
          name: "Near Garden",
          "addr:street": "Market St",
          "addr:city": "San Francisco",
          website: "https://example.org",
          phone: "+1 555 0100",
        },
      },
      {
        type: "way",
        id: 9,
        // missing coords — dropped
        tags: { name: "No coords" },
      },
    ];

    const places = parseOverpassElements(elements, {
      center,
      categoryId: "parks",
    });

    expect(places).toHaveLength(2);
    expect(places[0]?.name).toBe("Near Garden");
    expect(places[0]?.isUnnamed).toBe(false);
    expect(places[0]?.address).toContain("Market St");
    expect(places[0]?.website).toBe("https://example.org");
    expect(places[0]?.phone).toBe("+1 555 0100");
    expect(places[0]?.hours).toBeUndefined();
    expect(places[0]?.sources.osm).toBe(true);
    expect(places[1]?.name).toBe("Far Park");
    expect(places[1]?.hours).toBe("Mo-Su 08:00-18:00");
    expect(places[0]!.distanceM).toBeLessThan(places[1]!.distanceM);
  });

  it("labels unnamed parks instead of way/id", () => {
    const places = parseOverpassElements(
      [
        {
          type: "way",
          id: 99,
          center: { lat: 37.77, lon: -122.42 },
          tags: { leisure: "park" },
        },
      ],
      { center, categoryId: "parks" },
    );
    expect(places[0]?.name).toBe("Unnamed park");
    expect(places[0]?.isUnnamed).toBe(true);
  });

  it("sorts named places before unnamed", () => {
    const places = parseOverpassElements(
      [
        {
          type: "node",
          id: 1,
          lat: 37.77,
          lon: -122.42,
          tags: { leisure: "park" },
        },
        {
          type: "node",
          id: 2,
          lat: 37.771,
          lon: -122.42,
          tags: { name: "Named Park", leisure: "park" },
        },
      ],
      { center, categoryId: "parks" },
    );
    expect(places[0]?.name).toBe("Named Park");
    expect(places[1]?.name).toBe("Unnamed park");
  });

  it("uses way center coordinates", () => {
    const places = parseOverpassElements(
      [
        {
          type: "way",
          id: 44,
          center: { lat: 37.775, lon: -122.419 },
          tags: { name: "Civic Center" },
        },
      ],
      { center, categoryId: "parks" },
    );
    expect(places).toHaveLength(1);
    expect(places[0]?.lat).toBe(37.775);
    expect(places[0]?.id).toBe("osm:way/44");
  });

  it("deduplicates by osm type/id", () => {
    const el: OverpassElement = {
      type: "node",
      id: 7,
      lat: 37.77,
      lon: -122.42,
      tags: { name: "Dup" },
    };
    const places = parseOverpassElements([el, el], {
      center,
      categoryId: "shops",
    });
    expect(places).toHaveLength(1);
  });
});

describe("computeOsmCoverage", () => {
  it("reports percentages for tagged fields", () => {
    const places = parseOverpassElements(
      [
        {
          type: "node",
          id: 1,
          lat: 37.77,
          lon: -122.42,
          tags: {
            name: "A",
            opening_hours: "24/7",
            website: "https://a.test",
            "addr:street": "Main",
          },
        },
        {
          type: "node",
          id: 2,
          lat: 37.771,
          lon: -122.42,
          tags: { name: "B", phone: "123" },
        },
      ],
      { center, categoryId: "cafes" },
    );

    const coverage = computeOsmCoverage(places);
    expect(coverage.total).toBe(2);
    expect(coverage.hoursPct).toBe(50);
    expect(coverage.websitePct).toBe(50);
    expect(coverage.phonePct).toBe(50);
    expect(coverage.addressPct).toBe(50);
  });
});

describe("contact tag fallbacks", () => {
  it("maps contact:* and service_times into place fields", () => {
    const [place] = parseOverpassElements(
      [
        {
          type: "node",
          id: 9,
          lat: 37.77,
          lon: -122.42,
          tags: {
            name: "Contact Cafe",
            "contact:website": "https://contact.test",
            "contact:phone": "+1 555",
            service_times: "Mo-Fr 09:00-17:00",
            "addr:place": "Market Hall",
            "addr:suburb": "Mission",
          },
        },
      ],
      { center, categoryId: "cafes" },
    );

    expect(place.website).toBe("https://contact.test");
    expect(place.phone).toBe("+1 555");
    expect(place.hours).toBe("Mo-Fr 09:00-17:00");
    expect(place.address).toContain("Market Hall");
    expect(place.address).toContain("Mission");
  });

  it("normalizes bare website hosts and broader phone/hours tags", () => {
    const [place] = parseOverpassElements(
      [
        {
          type: "node",
          id: 10,
          lat: 37.77,
          lon: -122.42,
          tags: {
            name: "Bare Host",
            website: "example.org/menu",
            telephone: "+1 555 0199",
            "opening_hours:kitchen": "Mo-Fr 11:00-14:00",
            "addr:housenumber": "12",
            "addr:street": "Oak St",
            "addr:state": "CA",
          },
        },
      ],
      { center, categoryId: "restaurants" },
    );

    expect(place.website).toBe("https://example.org/menu");
    expect(place.phone).toBe("+1 555 0199");
    expect(place.hours).toBe("Mo-Fr 11:00-14:00");
    expect(place.address).toContain("12");
    expect(place.address).toContain("Oak St");
    expect(place.address).toContain("CA");
  });
});
