import type { OsmPlace } from "./types";

/** Google Place IDs are the only Google fields kept in this export. */
export function toGooglePlaceIds(places: OsmPlace[]): string[] {
  return [...new Set(places.flatMap((place) => {
    if (place.source !== "google" || place.sources.google !== true ||
        typeof place.googlePlaceId !== "string") return [];
    const id = place.googlePlaceId.trim();
    return id && place.id === `google:${id}` ? [id] : [];
  }))];
}

export type GoogleIdsFormat = "csv" | "json";

export function googleIdsToExport(places: OsmPlace[], format: GoogleIdsFormat): {
  filename: string;
  mime: string;
  body: string;
} {
  const ids = toGooglePlaceIds(places);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  if (format === "csv") {
    return {
      filename: `places-google-ids-${stamp}.csv`,
      mime: "text/csv;charset=utf-8",
      body: `place_id\n${ids.map((id) => `"${id.replace(/"/g, '""')}"`).join("\n")}${ids.length ? "\n" : ""}`,
    };
  }
  return {
    filename: `places-google-ids-${stamp}.json`,
    mime: "application/json;charset=utf-8",
    body: `${JSON.stringify({ placeIds: ids }, null, 2)}\n`,
  };
}
