/** Google Places API (New) — display-only types. Never export these fields. */

import type { GoogleMatchInfo } from "./google-match";

export type GooglePlaceReview = {
  rating?: number;
  text?: string;
  originalText?: string;
  authorName?: string;
  authorUri?: string;
  authorPhotoUri?: string;
  relativeTime?: string;
  publishTime?: string;
  googleMapsUri?: string;
  flagContentUri?: string;
  visitDateMonth?: number;
  visitDateYear?: number;
};

/** Official Places `reviewSummary` — show verbatim; never paraphrase. */
export type GoogleReviewSummary = {
  text: string;
  /** Google disclosure e.g. “Summarized with Gemini”. */
  disclosureText?: string;
};

/** Any AI-generated Places summary block (place / neighborhood / EVCS). */
export type GoogleAiSummary = {
  text: string;
  disclosureText?: string;
};

export type GoogleEvCharging = {
  connectorCount?: number;
  connectors: Array<{
    /** Connector type label, e.g. “CCS”, “Tesla”. */
    type: string;
    maxKw?: number;
    count?: number;
    available?: number;
  }>;
};

export type GoogleFuelPrice = {
  /** Fuel type label, e.g. “Regular unleaded”. */
  label: string;
  price: string;
  updatedAt?: string;
};

/**
 * Official Places “Enterprise + Atmosphere” attributes.
 * Display-only — same billing SKU as `reviews`, so they are free to request
 * alongside a Details call that already asks for reviews/reviewSummary.
 */
export type GooglePlaceAttributes = {
  /** “Free” / “$” … “$$$$” from `priceLevel`. */
  priceLevelLabel?: string;
  /** e.g. “$10.00–$20.00” from `priceRange` when Google returns it. */
  priceRangeLabel?: string;
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
  /** Live open/closed from `currentOpeningHours.openNow`. */
  openNow?: boolean;
  /** Hours including holiday/special-day overrides. */
  currentHoursWeekday?: string[];
  /** Google editorial blurb — show verbatim, never paraphrase. */
  editorialSummary?: string;
  /** AI place overview (Gemini). */
  generativeSummary?: GoogleAiSummary;
  /** AI neighborhood overview. */
  neighborhoodSummary?: GoogleAiSummary;
  /** AI EV-charging amenity overview. */
  evChargeAmenitySummary?: GoogleAiSummary;
  evCharging?: GoogleEvCharging;
  fuelPrices?: GoogleFuelPrice[];
  accessibility?: string[];
  payment?: string[];
  parking?: string[];
  /** e.g. “Outdoor seating”, “Dog friendly”. */
  amenities?: string[];
  /** e.g. “Breakfast”, “Cocktails”. */
  serves?: string[];
};

export type GooglePlaceDetails = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  hoursWeekday?: string[];
  /** Richer official attributes (optional — older cached shells omit it). */
  attributes?: GooglePlaceAttributes;
  phone?: string;
  website?: string;
  googleMapsUri?: string;
  /**
   * Customer ID parsed from `googleMapsUri` when Places includes `?cid=`.
   * Not the same as scrape-style Maps `data_id` (which the official API does not return).
   */
  mapsCid?: string;
  rating?: number;
  userRatingCount?: number;
  reviews: GooglePlaceReview[];
  /** Official AI review summary from Place Details (not app-written). */
  reviewSummary?: GoogleReviewSummary;
  primaryType?: string;
  /** Prefer “Google Maps” for review blocks. */
  attribution: string;
};

export type GoogleLookupSuccess = {
  status: "ok";
  details: GooglePlaceDetails;
  /** Present for OSM→Google name lookup; omitted for direct placeId fetches. */
  match?: GoogleMatchInfo;
};

export type GoogleLookupEmpty = {
  status: "empty";
  message: string;
};

export type GoogleLookupUnavailable = {
  status: "unavailable";
  message: string;
};

export type GoogleLookupError = {
  status: "error";
  message: string;
  retryable: boolean;
};

export type GoogleLookupResponse =
  | GoogleLookupSuccess
  | GoogleLookupEmpty
  | GoogleLookupUnavailable
  | GoogleLookupError;

export type GoogleStatusResponse = {
  configured: boolean;
  message: string;
};

export type { GoogleMatchInfo };
