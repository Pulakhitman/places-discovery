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

export type GooglePlacePhoto = {
  /** Resource name e.g. places/ChIJ…/photos/… */
  name: string;
  widthPx?: number;
  heightPx?: number;
  /** Proxied app URL for display (never hotlink without attribution). */
  mediaUrl: string;
};

export type GooglePlaceDetails = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  hoursWeekday?: string[];
  phone?: string;
  website?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  reviews: GooglePlaceReview[];
  photos: GooglePlacePhoto[];
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
