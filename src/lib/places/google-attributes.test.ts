import { describe, expect, it } from "vitest";
import { mapGoogleAttributes } from "./google-attributes";

describe("mapGoogleAttributes", () => {
  it("returns undefined when Google sends nothing extra", () => {
    expect(mapGoogleAttributes({})).toBeUndefined();
  });

  it("maps price level and price range", () => {
    const attributes = mapGoogleAttributes({
      priceLevel: "PRICE_LEVEL_MODERATE",
      priceRange: {
        startPrice: { currencyCode: "USD", units: "10" },
        endPrice: { currencyCode: "USD", units: "20" },
      },
    });
    expect(attributes?.priceLevelLabel).toBe("$$");
    expect(attributes?.priceRangeLabel).toBe("$10.00–$20.00");
  });

  it("maps open state, business status, and current hours", () => {
    const attributes = mapGoogleAttributes({
      businessStatus: "CLOSED_TEMPORARILY",
      currentOpeningHours: {
        openNow: false,
        weekdayDescriptions: ["Monday: Closed", "Tuesday: 9 AM–5 PM"],
      },
    });
    expect(attributes).toMatchObject({
      businessStatus: "CLOSED_TEMPORARILY",
      openNow: false,
      currentHoursWeekday: ["Monday: Closed", "Tuesday: 9 AM–5 PM"],
    });
  });

  it("ignores unknown business status values", () => {
    expect(
      mapGoogleAttributes({ businessStatus: "SOMETHING_ELSE" })?.businessStatus,
    ).toBeUndefined();
  });

  it("collects only the boolean features Google sets to true", () => {
    const attributes = mapGoogleAttributes({
      servesVegetarianFood: true,
      servesBeer: false,
      outdoorSeating: true,
      allowsDogs: true,
      accessibilityOptions: {
        wheelchairAccessibleEntrance: true,
        wheelchairAccessibleRestroom: false,
      },
      paymentOptions: { acceptsCreditCards: true, acceptsCashOnly: false },
      parkingOptions: { freeStreetParking: true },
    });
    expect(attributes?.serves).toEqual(["Vegetarian options"]);
    expect(attributes?.amenities).toEqual([
      "Outdoor seating",
      "Dog friendly",
    ]);
    expect(attributes?.accessibility).toEqual(["Accessible entrance"]);
    expect(attributes?.payment).toEqual(["Credit cards"]);
    expect(attributes?.parking).toEqual(["Free street parking"]);
  });

  it("keeps the editorial summary verbatim", () => {
    expect(
      mapGoogleAttributes({
        editorialSummary: { text: "  Family-run noodle shop.  " },
      })?.editorialSummary,
    ).toBe("Family-run noodle shop.");
  });

  it("maps AI summaries with their disclosure text", () => {
    const attributes = mapGoogleAttributes({
      generativeSummary: {
        overview: { text: "A lively corner cafe." },
        disclosureText: { text: "Summarized with Gemini" },
      },
      neighborhoodSummary: { overview: { text: "Busy market district." } },
    });
    expect(attributes?.generativeSummary).toEqual({
      text: "A lively corner cafe.",
      disclosureText: "Summarized with Gemini",
    });
    expect(attributes?.neighborhoodSummary?.text).toBe("Busy market district.");
    expect(attributes?.neighborhoodSummary?.disclosureText).toBeUndefined();
  });

  it("maps EV charging connectors", () => {
    const attributes = mapGoogleAttributes({
      evChargeOptions: {
        connectorCount: 6,
        connectorAggregation: [
          {
            type: "EV_CONNECTOR_TYPE_CCS_COMBO_2",
            maxChargeRateKw: 150,
            count: 4,
            availableCount: 2,
          },
          { type: "EV_CONNECTOR_TYPE_TESLA", count: 2 },
        ],
      },
    });
    expect(attributes?.evCharging?.connectorCount).toBe(6);
    expect(attributes?.evCharging?.connectors).toEqual([
      { type: "CCS Combo 2", maxKw: 150, count: 4, available: 2 },
      { type: "Tesla", maxKw: undefined, count: 2, available: undefined },
    ]);
  });

  it("maps fuel prices", () => {
    const attributes = mapGoogleAttributes({
      fuelOptions: {
        fuelPrices: [
          {
            type: "REGULAR_UNLEADED",
            price: { currencyCode: "USD", units: "4", nanos: 190_000_000 },
          },
        ],
      },
    });
    expect(attributes?.fuelPrices).toEqual([
      { label: "Regular unleaded", price: "$4.19", updatedAt: undefined },
    ]);
  });
});
