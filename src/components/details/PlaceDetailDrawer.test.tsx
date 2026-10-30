// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OsmPlace } from "@/lib/places/types";
import { osmEnrichmentSnapshot, PlaceDetailDrawer } from "./PlaceDetailDrawer";

const osm: OsmPlace = { id: "osm:node/1", source: "osm", osmType: "node", osmId: 1, name: "Central Cafe", isUnnamed: false,
  categoryId: "cafes", categoryLabel: "Cafés", lat: 42.35, lng: -71.06, distanceM: 10, address: "10 Main St, Boston",
  tags: { "addr:housenumber": "10", "addr:street": "Main St" }, sources: { osm: true } };
const google: OsmPlace = { id: "google:ChIJgoogle123", source: "google", googlePlaceId: "ChIJgoogle123", name: "Central Café & Bakery",
  isUnnamed: false, categoryId: "cafes", categoryLabel: "Cafés", lat: 42.3501, lng: -71.0601, distanceM: 12,
  address: "10 Main Street, Boston, MA 02110, USA", phone: "+1 617 555 0100", tags: {}, sources: { google: true } };
/** Typed loosely until `OsmPlace.matchedOsm` lands; extra keys must never reach a provider. */
function merged(matchedOsm: unknown): OsmPlace {
  return { ...google, sources: { google: true, osm: true }, matchedOsm } as OsmPlace;
}

const PROVIDER_URLS = ["/api/places/foursquare", "/api/places/besttime", "/api/health"];
let fetcher: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;
beforeEach(() => {
  const bodies: Record<string, unknown> = {
    "/api/places/google/status": { configured: false, message: "Google Places is off." },
    "/api/places/google/lookup": { status: "unavailable", message: "Google Places is not configured." },
    "/api/health": { bestTimeKeyStatus: { privateKey: "ok", publicKey: "missing" } },
    "/api/places/foursquare": { status: "empty", message: "No sufficiently close Foursquare match found." },
    "/api/places/besttime": { status: "error", message: "BestTime request failed." },
  };
  fetcher = vi.fn(async (url: string) => new Response(JSON.stringify(bodies[url]), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); sessionStorage.clear(); });

const providerCalls = () => fetcher.mock.calls.filter(([url]) => PROVIDER_URLS.includes(url));
const googleDetailCalls = () => fetcher.mock.calls.filter(([url]) => url.startsWith("/api/places/google/") && url !== "/api/places/google/status");
const providerBodies = () => fetcher.mock.calls.filter(([url]) => url !== "/api/health" && PROVIDER_URLS.includes(url)).map(([, init]) => String(init?.body));
const openDrawer = async (place: OsmPlace) => {
  render(<PlaceDetailDrawer place={place} open onClose={() => {}} />);
  await screen.findByRole("button", { name: "Load Google details (paid request)" });
};

describe("PlaceDetailDrawer enrichment", () => {
  it("explains Google-only rows in the summary and both panels, and calls no provider", async () => {
    await openDrawer(google);
    expect(screen.getByText(/Google only/)).toBeTruthy();
    expect(screen.getByText(/This result has no independent OSM record: Google and Overture data are never sent to Foursquare or BestTime\. Search with OpenStreetMap or Both, then open an independently found OSM row/)).toBeTruthy();
    expect(screen.getByText(/Google’s official Places API has no busy hours/)).toBeTruthy();
    expect(screen.getByText("Foursquare unavailable: Google-only result")).toBeTruthy();
    expect(screen.getByText("Busy hours unavailable: Google-only result")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Load Google details (paid request)" })).toBeTruthy();
    expect(screen.queryByText("Not tagged in OSM")).toBeNull();
    expect(providerCalls()).toHaveLength(0);
    expect(googleDetailCalls()).toHaveLength(0);
  });

  it("does not look up an OSM row on opening, but requests a lookup after clicking", async () => {
    await openDrawer(osm);
    expect(googleDetailCalls()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Load Google details (paid request)" }));
    await waitFor(() => expect(fetcher.mock.calls.some(([url]) => url === "/api/places/google/lookup")).toBe(true));
  });

  it("loads a Google result's known Place ID only after the paid action, without Text Search", async () => {
    fetcher.mockImplementation(async (url: string) => new Response(JSON.stringify(
      url === "/api/places/google/ChIJgoogle123"
        ? { status: "ok", details: { placeId: "ChIJgoogle123", name: google.name, lat: google.lat, lng: google.lng,
            reviews: [], attribution: "Google Maps" } }
        : { configured: true, message: "Google Places ready." },
    ), { status: 200, headers: { "Content-Type": "application/json" } }));
    await openDrawer(google);
    expect(googleDetailCalls()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Load Google details (paid request)" }));
    await waitFor(() => expect(googleDetailCalls()).toHaveLength(1));
    expect(googleDetailCalls()[0][0]).toBe("/api/places/google/ChIJgoogle123");
    expect(fetcher.mock.calls.some(([url]) => url === "/api/places/google/lookup")).toBe(false);
    await screen.findByText("Google IDs");
    expect(screen.getByText("ChIJgoogle123")).toBeTruthy();
  });

  it("labels the matched OSM record and sends only its original OSM data to both providers", async () => {
    await openDrawer(merged({ ...osm, googleRating: 4.9, tags: { ...osm.tags, "name:fr": "Café Central" } }));
    expect(screen.getByText(/Google \+ matched OSM/)).toBeTruthy();
    expect(screen.getByText("Matched OpenStreetMap record")).toBeTruthy();
    expect(screen.getByText(/on request · paid/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Find Foursquare match (Pro)" }));
    await screen.findByText("No sufficiently close Foursquare match found.");
    const forecast = screen.getByRole("button", { name: "Create weekly forecast (paid request)" }) as HTMLButtonElement;
    await waitFor(() => expect(forecast.disabled).toBe(false));
    fireEvent.click(forecast);
    await screen.findByText("BestTime request failed.");

    const [foursquare, besttime] = providerBodies().map((body) => JSON.parse(body));
    expect(foursquare).toEqual({ action: "search", name: "Central Cafe", lat: 42.35, lng: -71.06 });
    expect(besttime).toMatchObject({ action: "forecast", id: "osm:node/1", source: "osm", sources: { osm: true }, name: "Central Cafe",
      address: "10 Main St, Boston", lat: 42.35, lng: -71.06, tags: { "addr:housenumber": "10", "addr:street": "Main St" } });
    for (const body of providerBodies()) {
      for (const leaked of ["Bakery", "Main Street", "ChIJ", "google", "4.9", "555", "42.3501", "Café Central"]) expect(body).not.toContain(leaked);
    }
  });

  it.each([
    ["sources.google", { ...osm, sources: { osm: true, google: true } }],
    ["googlePlaceId", { ...osm, googlePlaceId: "ChIJgoogle123" }],
    ["Google source", { ...osm, source: "google" }],
    ["inconsistent OSM id", { ...osm, osmId: 2 }],
    ["missing", undefined],
  ])("treats a merged row whose OSM snapshot is %s as Google-only", async (_, snapshot) => {
    await openDrawer(merged(snapshot));
    expect(screen.queryByText("Matched OpenStreetMap record")).toBeNull();
    expect(screen.getByText("Busy hours unavailable: Google-only result")).toBeTruthy();
    expect(screen.getByText("Foursquare unavailable: Google-only result")).toBeTruthy();
    expect(providerCalls()).toHaveLength(0);
  });

  it("explains foot-traffic eligibility for OSM rows without a precise address or name", async () => {
    await openDrawer({ ...osm, address: "Boston", tags: { "addr:city": "Boston" } });
    expect(screen.getByText("Busy hours unavailable: OSM address has no street or house number")).toBeTruthy();
    // Drawer summary + BestTime panel.
    expect(screen.getAllByText(/unavailable: OSM address has no street or house number/)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Find Foursquare match (Pro)" })).toBeTruthy();
    cleanup();
    await openDrawer({ ...osm, name: "Unnamed cafe", isUnnamed: true });
    expect(screen.getByText("Busy hours unavailable: Unnamed in OpenStreetMap")).toBeTruthy();
    expect(screen.getByText("Foursquare unavailable: Unnamed in OpenStreetMap")).toBeTruthy();
    expect(providerCalls()).toHaveLength(0);
  });
});

describe("osmEnrichmentSnapshot", () => {
  it("uses OSM rows as-is and rebuilds matched snapshots from allowlisted OSM fields", () => {
    expect(osmEnrichmentSnapshot(osm)).toEqual(osm);
    const snapshot = osmEnrichmentSnapshot(merged({ ...osm, googleRating: 4.9, tags: { ...osm.tags, bad: 1 } }));
    expect(snapshot).toEqual(osm);
    expect(snapshot).not.toHaveProperty("googleRating");
    expect(osmEnrichmentSnapshot(google)).toBeNull();
  });
});
