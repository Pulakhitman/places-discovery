// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FoursquareResponse } from "@/lib/places/foursquare-types";
import type { OsmPlace } from "@/lib/places/types";
import { FoursquarePanel } from "./FoursquarePanel";

const place: OsmPlace = { id: "osm:node/1", source: "osm", osmType: "node", osmId: 1, name: "Central Cafe", isUnnamed: false,
  categoryId: "cafes", categoryLabel: "Cafés", lat: 42.35, lng: -71.06, distanceM: 10, address: "10 Main St, Boston",
  tags: { "addr:housenumber": "10", "addr:street": "Main St" }, sources: { osm: true } };
const fsq = { id: "fsq12345678", name: "Central Cafe", lat: 42.35, lng: -71.06, link: "https://foursquare.com/v/fsq12345678", categories: ["Café"], chains: [] };

function mockFetch(...responses: FoursquareResponse[]) {
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () =>
    new Response(JSON.stringify(responses.shift()), { status: 200, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const bodies = (fetcher: ReturnType<typeof mockFetch>) => fetcher.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("FoursquarePanel", () => {
  it("explains Google-only rows with OSM search guidance and sends nothing", () => {
    const fetcher = mockFetch();
    for (const google of [null, { ...place, id: "google:abc", source: "google" as const, googlePlaceId: "abc", sources: { google: true as const } }]) {
      const view = render(<FoursquarePanel place={google} />);
      expect(screen.getByText("Foursquare unavailable: Google-only result")).toBeTruthy();
      expect(screen.getByText(/Google data is never sent to Foursquare\. Search with OpenStreetMap or Both, then open an independently found OSM row/)).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
      view.unmount();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("explains unnamed OSM rows instead of rendering nothing", () => {
    const fetcher = mockFetch();
    render(<FoursquarePanel place={{ ...place, name: "Unnamed cafe", isUnnamed: true }} />);
    expect(screen.getByText("Foursquare unavailable: Unnamed in OpenStreetMap")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("searches only on click with OSM name/coordinates, and loads Premium only on a second explicit click", async () => {
    const fetcher = mockFetch(
      { status: "ok", tier: "pro", match: { place: fsq, confidence: "strong", distanceM: 4, nameSimilarity: 1 } },
      { status: "ok", tier: "premium", match: { place: { ...fsq, rating: 8.7, popularWindows: [{ day: 1, open: "0800", close: "1000" }] }, confidence: "strong", distanceM: 4, nameSimilarity: 1 } },
    );
    render(<FoursquarePanel place={place} matched />);
    expect(screen.getByText(/Uses the matched OpenStreetMap record/)).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Find Foursquare match (Pro)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Load Premium details (paid API call)" }));
    expect(await screen.findByText("Popular time windows (not hourly traffic)")).toBeTruthy();
    expect(bodies(fetcher)).toEqual([
      { action: "search", name: "Central Cafe", lat: 42.35, lng: -71.06 },
      { action: "premium", name: "Central Cafe", lat: 42.35, lng: -71.06, id: "fsq12345678", confirmWeak: false },
    ]);
  });

  it("requires confirming a weak match before showing details or offering Premium", async () => {
    mockFetch({ status: "ok", tier: "pro", match: { place: fsq, confidence: "weak", distanceM: 120, nameSimilarity: 0.7 } });
    render(<FoursquarePanel place={place} />);
    fireEvent.click(screen.getByRole("button", { name: "Find Foursquare match (Pro)" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use this Foursquare match" }));
    expect(screen.getByRole("button", { name: "Load Premium details (paid API call)" })).toBeTruthy();
  });
});
