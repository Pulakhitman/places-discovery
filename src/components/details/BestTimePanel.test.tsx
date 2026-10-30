// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OsmPlace } from "@/lib/places/types";
import { BestTimePanel } from "./BestTimePanel";

const place: OsmPlace = { id: "osm:node/1", source: "osm", osmType: "node", osmId: 1, name: "Central Cafe", isUnnamed: false,
  categoryId: "cafes", categoryLabel: "Cafés", lat: 42.35, lng: -71.06, distanceM: 10, address: "10 Main St, Boston",
  tags: { "addr:housenumber": "10", "addr:street": "Main St" }, sources: { osm: true } };

function mockFetch(health: unknown, besttime?: unknown) {
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) =>
    new Response(JSON.stringify(url === "/api/health" ? health : besttime), { status: url === "/api/health" ? 200 : 503, headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const besttimeCalls = (fetcher: ReturnType<typeof mockFetch>) => fetcher.mock.calls.filter(([url]) => url === "/api/places/besttime");
const buttons = () => [screen.getByRole("button", { name: /weekly forecast/ }), screen.getByRole("button", { name: /live busyness/ })] as HTMLButtonElement[];
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("BestTimePanel", () => {
  it("shows a disabled read-only state for a public key only and never requests BestTime", async () => {
    const fetcher = mockFetch({ bestTimeKeyStatus: { privateKey: "missing", publicKey: "ok" } });
    render(<BestTimePanel place={place} />);
    expect(await screen.findByText("Read-only BestTime key only")).toBeTruthy();
    expect(screen.getByText("BESTTIME_PRIVATE_API_KEY is not set.")).toBeTruthy();
    expect(screen.getByText("BESTTIME_PRIVATE_API_KEY=pri_…")).toBeTruthy();
    for (const button of buttons()) { expect(button.disabled).toBe(true); fireEvent.click(button); }
    expect(besttimeCalls(fetcher)).toHaveLength(0);
  });
  it("explains a public key stored in the private slot", async () => {
    mockFetch({ bestTimeKeyStatus: { privateKey: "wrong_type", publicKey: "missing" } });
    render(<BestTimePanel place={place} />);
    expect(await screen.findByText("BestTime is not set up")).toBeTruthy();
    expect(screen.getByText(/holds a public key \(pub_…\)/)).toBeTruthy();
  });
  it("enables buttons when configured, calls BestTime only on click, and falls back to the notice on 503", async () => {
    const fetcher = mockFetch({ bestTimeKeyStatus: { privateKey: "ok", publicKey: "missing" } }, { status: "unavailable", message: "BestTime is not configured." });
    render(<BestTimePanel place={place} />);
    await waitFor(() => expect(buttons()[0].disabled).toBe(false));
    expect(besttimeCalls(fetcher)).toHaveLength(0);
    fireEvent.click(buttons()[0]);
    expect(await screen.findByText("BestTime is not set up")).toBeTruthy();
    expect(besttimeCalls(fetcher)).toHaveLength(1);
    expect(JSON.parse(String(besttimeCalls(fetcher)[0][1]?.body)).action).toBe("forecast");
    expect(buttons().every((button) => button.disabled)).toBe(true);
  });
  it("explains Google-only rows and fetches nothing, not even the setup check", () => {
    const fetcher = mockFetch({});
    for (const google of [null, { ...place, source: "google" as const, googlePlaceId: "x", sources: { google: true as const } }, { ...place, sources: { osm: true as const, google: true as const } }]) {
      const view = render(<BestTimePanel place={google} />);
      expect(screen.getByText("Busy hours unavailable: Google-only result")).toBeTruthy();
      expect(screen.getByText(/Google data is never sent to BestTime\. Search with OpenStreetMap or Both, then open an independently found OSM row/)).toBeTruthy();
      expect(screen.getByText(/Google’s official Places API has no busy-hours data/)).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
      view.unmount();
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    ["unnamed", { isUnnamed: true, name: "Unnamed cafe" }, "Unnamed in OpenStreetMap"],
    ["no address", { address: undefined, tags: {} }, "No address in OpenStreetMap"],
    ["city-only address", { address: "Boston", tags: { "addr:city": "Boston" } }, "OSM address has no street or house number"],
    ["no house number", { address: "Main St, Boston", tags: { "addr:street": "Main St" } }, "OSM address has no house number"],
    ["no street", { address: "10, Boston", tags: { "addr:housenumber": "10" } }, "OSM address has no street"],
  ])("explains an ineligible OSM row (%s) instead of rendering nothing", (_, patch, reason) => {
    const fetcher = mockFetch({});
    render(<BestTimePanel place={{ ...place, ...patch }} />);
    expect(screen.getByText(`Busy hours unavailable: ${reason}`)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("sends only OSM name, address and address tags for a matched OSM record", async () => {
    const fetcher = mockFetch({ bestTimeKeyStatus: { privateKey: "ok", publicKey: "missing" } }, { status: "error", message: "BestTime request failed." });
    const osm = { ...place, tags: { ...place.tags, "name:fr": "Café Central", phone: "+1 555" } };
    render(<BestTimePanel place={osm} matched />);
    expect(screen.getByText(/Uses the matched OpenStreetMap record/)).toBeTruthy();
    await waitFor(() => expect(buttons()[1].disabled).toBe(false));
    fireEvent.click(buttons()[1]);
    expect(await screen.findByRole("alert")).toBeTruthy();
    const body = JSON.parse(String(besttimeCalls(fetcher)[0][1]?.body));
    expect(body).toEqual({ action: "live", id: "osm:node/1", source: "osm", sources: { osm: true }, isUnnamed: false, name: "Central Cafe",
      address: "10 Main St, Boston", tags: { "addr:housenumber": "10", "addr:street": "Main St" }, lat: 42.35, lng: -71.06 });
  });
});
