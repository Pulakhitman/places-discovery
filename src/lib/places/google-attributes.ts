/**
 * Mapping for official Places (New) “Enterprise + Atmosphere” attributes.
 * Everything here comes straight from Place Details — no scraping, no guesses.
 */

import type {
  GoogleAiSummary,
  GoogleEvCharging,
  GoogleFuelPrice,
  GooglePlaceAttributes,
} from "./google-types";

export type GoogleMoney = {
  currencyCode?: string;
  units?: string;
  nanos?: number;
};

/** Shared shape for Google's AI-generated summary blocks. */
export type GoogleSummaryRaw = {
  overview?: { text?: string; languageCode?: string };
  disclosureText?: { text?: string; languageCode?: string };
};

export type GoogleAttributesRaw = {
  priceLevel?: string;
  priceRange?: { startPrice?: GoogleMoney; endPrice?: GoogleMoney };
  businessStatus?: string;
  currentOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  editorialSummary?: { text?: string; languageCode?: string };
  /** AI-powered place overview. */
  generativeSummary?: GoogleSummaryRaw;
  /** AI-powered neighborhood overview. */
  neighborhoodSummary?: GoogleSummaryRaw;
  /** AI-powered EV-charging amenity overview. */
  evChargeAmenitySummary?: GoogleSummaryRaw;
  evChargeOptions?: {
    connectorCount?: number;
    connectorAggregation?: Array<{
      type?: string;
      maxChargeRateKw?: number;
      count?: number;
      availableCount?: number;
      outOfServiceCount?: number;
    }>;
  };
  fuelOptions?: {
    fuelPrices?: Array<{
      type?: string;
      price?: GoogleMoney;
      updateTime?: string;
    }>;
  };
  accessibilityOptions?: {
    wheelchairAccessibleParking?: boolean;
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleRestroom?: boolean;
    wheelchairAccessibleSeating?: boolean;
  };
  paymentOptions?: {
    acceptsCreditCards?: boolean;
    acceptsDebitCards?: boolean;
    acceptsCashOnly?: boolean;
    acceptsNfc?: boolean;
  };
  parkingOptions?: {
    freeParkingLot?: boolean;
    paidParkingLot?: boolean;
    freeStreetParking?: boolean;
    paidStreetParking?: boolean;
    valetParking?: boolean;
    freeGarageParking?: boolean;
    paidGarageParking?: boolean;
  };
  allowsDogs?: boolean;
  curbsidePickup?: boolean;
  delivery?: boolean;
  dineIn?: boolean;
  goodForChildren?: boolean;
  goodForGroups?: boolean;
  goodForWatchingSports?: boolean;
  liveMusic?: boolean;
  menuForChildren?: boolean;
  outdoorSeating?: boolean;
  reservable?: boolean;
  restroom?: boolean;
  takeout?: boolean;
  servesBeer?: boolean;
  servesBreakfast?: boolean;
  servesBrunch?: boolean;
  servesCocktails?: boolean;
  servesCoffee?: boolean;
  servesDessert?: boolean;
  servesDinner?: boolean;
  servesLunch?: boolean;
  servesVegetarianFood?: boolean;
  servesWine?: boolean;
};

const PRICE_LEVEL_LABELS: Record<string, string> = {
  PRICE_LEVEL_FREE: "Free",
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

const BUSINESS_STATUSES = new Set([
  "OPERATIONAL",
  "CLOSED_TEMPORARILY",
  "CLOSED_PERMANENTLY",
]);

/** Label maps keep the UI dumb: provider decides wording, not components. */
const ACCESSIBILITY_LABELS: Array<[keyof NonNullable<GoogleAttributesRaw["accessibilityOptions"]>, string]> = [
  ["wheelchairAccessibleParking", "Accessible parking"],
  ["wheelchairAccessibleEntrance", "Accessible entrance"],
  ["wheelchairAccessibleRestroom", "Accessible restroom"],
  ["wheelchairAccessibleSeating", "Accessible seating"],
];

const PAYMENT_LABELS: Array<[keyof NonNullable<GoogleAttributesRaw["paymentOptions"]>, string]> = [
  ["acceptsCreditCards", "Credit cards"],
  ["acceptsDebitCards", "Debit cards"],
  ["acceptsNfc", "Contactless (NFC)"],
  ["acceptsCashOnly", "Cash only"],
];

const PARKING_LABELS: Array<[keyof NonNullable<GoogleAttributesRaw["parkingOptions"]>, string]> = [
  ["freeParkingLot", "Free parking lot"],
  ["paidParkingLot", "Paid parking lot"],
  ["freeStreetParking", "Free street parking"],
  ["paidStreetParking", "Paid street parking"],
  ["freeGarageParking", "Free garage parking"],
  ["paidGarageParking", "Paid garage parking"],
  ["valetParking", "Valet parking"],
];

const AMENITY_LABELS: Array<[keyof GoogleAttributesRaw, string]> = [
  ["dineIn", "Dine-in"],
  ["takeout", "Takeout"],
  ["delivery", "Delivery"],
  ["curbsidePickup", "Curbside pickup"],
  ["outdoorSeating", "Outdoor seating"],
  ["reservable", "Accepts reservations"],
  ["goodForChildren", "Good for kids"],
  ["goodForGroups", "Good for groups"],
  ["goodForWatchingSports", "Good for watching sports"],
  ["allowsDogs", "Dog friendly"],
  ["liveMusic", "Live music"],
  ["menuForChildren", "Kids' menu"],
  ["restroom", "Restroom"],
];

const SERVES_LABELS: Array<[keyof GoogleAttributesRaw, string]> = [
  ["servesBreakfast", "Breakfast"],
  ["servesBrunch", "Brunch"],
  ["servesLunch", "Lunch"],
  ["servesDinner", "Dinner"],
  ["servesCoffee", "Coffee"],
  ["servesDessert", "Dessert"],
  ["servesBeer", "Beer"],
  ["servesWine", "Wine"],
  ["servesCocktails", "Cocktails"],
  ["servesVegetarianFood", "Vegetarian options"],
];

function formatMoney(money?: GoogleMoney): string | null {
  const units = money?.units;
  if (units === undefined) {
    return null;
  }
  const amount = Number(units) + (money?.nanos ?? 0) / 1e9;
  if (!Number.isFinite(amount)) {
    return null;
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: money?.currencyCode?.trim() || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return null;
  }
}

function pickTrue<T extends Record<string, unknown>>(
  source: T | undefined,
  labels: Array<[keyof T, string]>,
): string[] {
  if (!source) {
    return [];
  }
  const out: string[] = [];
  for (const [key, label] of labels) {
    if (source[key] === true) {
      out.push(label);
    }
  }
  return out;
}

function compact(values: string[]): string[] | undefined {
  return values.length > 0 ? values : undefined;
}

function mapSummary(raw?: GoogleSummaryRaw): GoogleAiSummary | undefined {
  const text = raw?.overview?.text?.trim();
  if (!text) {
    return undefined;
  }
  return {
    text,
    disclosureText: raw?.disclosureText?.text?.trim() || undefined,
  };
}

const CONNECTOR_LABELS: Record<string, string> = {
  EV_CONNECTOR_TYPE_CCS_COMBO_1: "CCS Combo 1",
  EV_CONNECTOR_TYPE_CCS_COMBO_2: "CCS Combo 2",
  EV_CONNECTOR_TYPE_CHADEMO: "CHAdeMO",
  EV_CONNECTOR_TYPE_J1772: "J1772",
  EV_CONNECTOR_TYPE_TESLA: "Tesla",
  EV_CONNECTOR_TYPE_TYPE_2: "Type 2",
  EV_CONNECTOR_TYPE_UNSPECIFIED: "Other",
  EV_CONNECTOR_TYPE_OTHER: "Other",
};

const FUEL_LABELS: Record<string, string> = {
  DIESEL: "Diesel",
  REGULAR_UNLEADED: "Regular unleaded",
  MIDGRADE: "Midgrade",
  PREMIUM: "Premium",
  SP91: "91 octane",
  SP91_E10: "91 octane (E10)",
  SP92: "92 octane",
  SP95: "95 octane",
  SP95_E10: "95 octane (E10)",
  SP98: "98 octane",
  SP99: "99 octane",
  SP100: "100 octane",
  LPG: "LPG",
  E80: "E80",
  E85: "E85",
  E100: "E100",
  METHANE: "Methane",
  BIO_DIESEL: "Biodiesel",
  TRUCK_DIESEL: "Truck diesel",
};

function mapEvCharging(
  raw?: GoogleAttributesRaw["evChargeOptions"],
): GoogleEvCharging | undefined {
  const connectors = (raw?.connectorAggregation ?? [])
    .filter((c) => typeof c.count === "number" && c.count > 0)
    .map((c) => ({
      type: CONNECTOR_LABELS[c.type ?? ""] ?? c.type?.trim() ?? "Other",
      maxKw: typeof c.maxChargeRateKw === "number" ? c.maxChargeRateKw : undefined,
      count: c.count,
      available: c.availableCount,
    }));

  const connectorCount =
    typeof raw?.connectorCount === "number" ? raw.connectorCount : undefined;

  if (connectorCount === undefined && connectors.length === 0) {
    return undefined;
  }
  return { connectorCount, connectors };
}

function mapFuelPrices(
  raw?: GoogleAttributesRaw["fuelOptions"],
): GoogleFuelPrice[] | undefined {
  const prices = (raw?.fuelPrices ?? [])
    .map((entry): GoogleFuelPrice | null => {
      const price = formatMoney(entry.price);
      if (!price) {
        return null;
      }
      return {
        label: FUEL_LABELS[entry.type ?? ""] ?? entry.type?.trim() ?? "Fuel",
        price,
        updatedAt: entry.updateTime?.trim() || undefined,
      };
    })
    .filter((entry): entry is GoogleFuelPrice => entry !== null);

  return prices.length > 0 ? prices : undefined;
}

export function mapGoogleAttributes(
  raw: GoogleAttributesRaw,
): GooglePlaceAttributes | undefined {
  const start = formatMoney(raw.priceRange?.startPrice);
  const end = formatMoney(raw.priceRange?.endPrice);
  const priceRangeLabel =
    start && end ? `${start}–${end}` : (start ?? end ?? undefined);

  const status = raw.businessStatus?.trim();
  const businessStatus = status && BUSINESS_STATUSES.has(status)
    ? (status as GooglePlaceAttributes["businessStatus"])
    : undefined;

  const currentHoursWeekday = raw.currentOpeningHours?.weekdayDescriptions
    ?.map((line) => line.trim())
    .filter(Boolean);

  const editorialSummary = raw.editorialSummary?.text?.trim() || undefined;

  const attributes: GooglePlaceAttributes = {
    priceLevelLabel: raw.priceLevel
      ? PRICE_LEVEL_LABELS[raw.priceLevel.trim()]
      : undefined,
    priceRangeLabel,
    businessStatus,
    openNow:
      typeof raw.currentOpeningHours?.openNow === "boolean"
        ? raw.currentOpeningHours.openNow
        : undefined,
    currentHoursWeekday:
      currentHoursWeekday && currentHoursWeekday.length > 0
        ? currentHoursWeekday
        : undefined,
    editorialSummary,
    generativeSummary: mapSummary(raw.generativeSummary),
    neighborhoodSummary: mapSummary(raw.neighborhoodSummary),
    evChargeAmenitySummary: mapSummary(raw.evChargeAmenitySummary),
    evCharging: mapEvCharging(raw.evChargeOptions),
    fuelPrices: mapFuelPrices(raw.fuelOptions),
    accessibility: compact(pickTrue(raw.accessibilityOptions, ACCESSIBILITY_LABELS)),
    payment: compact(pickTrue(raw.paymentOptions, PAYMENT_LABELS)),
    parking: compact(pickTrue(raw.parkingOptions, PARKING_LABELS)),
    amenities: compact(pickTrue(raw, AMENITY_LABELS)),
    serves: compact(pickTrue(raw, SERVES_LABELS)),
  };

  // Drop the shell entirely when Google returned nothing new.
  const hasAny = Object.values(attributes).some((value) =>
    Array.isArray(value) ? value.length > 0 : value !== undefined,
  );
  return hasAny ? attributes : undefined;
}
