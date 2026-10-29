import { afterEach, describe, expect, it, vi } from "vitest";
import { bestTimeConfigured, bestTimeKeyStatus, forecastHour, mapBestTimeForecast, mapBestTimeLive, matchBestTime, preciseOsmAddress, requestBestTime, validateBestTimeInput } from "./besttime";
import type { BestTimeInput } from "@/lib/places/besttime-types";

const input: BestTimeInput = { name: "Central Cafe", address: "10 Main St, Boston", lat: 42.35, lng: -71.06 };
const info = { venue_name: "Central Cafe", venue_address: "10 Main St, Boston", venue_lat: 42.3502, venue_lon: -71.0602 };
const days = Array.from({ length: 7 }, (_, day) => ({ day_info: { day_int: day }, day_raw: Array.from({ length: 24 }, (_, hour) => hour === 23 ? 100 : hour) }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("BestTime mapping", () => {
  it("requires street-level OSM address and rejects Google identities", () => {
    expect(preciseOsmAddress({ "addr:city": "Boston" }, "Boston")).toBeNull();
    const place = { ...input, id: "osm:node/123", source: "osm", sources: { osm: true }, isUnnamed: false, tags: { "addr:housenumber": "10", "addr:street": "Main St" } };
    expect(validateBestTimeInput(place)).toEqual(input);
    expect(validateBestTimeInput({ ...place, source: "google" })).toBeNull();
    expect(validateBestTimeInput({ ...place, googlePlaceId: "abc" })).toBeNull();
    expect(validateBestTimeInput({ ...place, sources: { osm: true, google: true } })).toBeNull();
  });
  it("uses 06:00 to 05:00 +1 and Monday to Sunday day_int, never calendar midnight", () => {
    expect([0, 17, 18, 23].map(forecastHour)).toEqual(["06:00", "23:00", "00:00 +1", "05:00 +1"]);
    const result = mapBestTimeForecast({ status: "OK", venue_info: info, analysis: [...days].reverse() }, input);
    expect(result?.days.map((day) => day.day)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(result?.days[0].hours[23]).toBe(100);
    expect(mapBestTimeForecast({ status: "OK", venue_info: info, analysis: days.slice(1) }, input)).toBeNull();
    expect(mapBestTimeForecast({ status: "OK", venue_info: info, analysis: [{ ...days[0], day_raw: Array(24).fill(101) }, ...days.slice(1)] }, input)).toBeNull();
  });
  it("rejects mismatched name or distance; accepts lon and lng; marks borderline matches weak", () => {
    expect(matchBestTime({ ...info, venue_name: "Other Bakery" }, input)).toBeNull();
    expect(matchBestTime({ ...info, venue_address: "12 Main St, Boston" }, input)).toBeNull();
    expect(matchBestTime({ ...info, venue_lat: 42.36 }, input)).toBeNull();
    expect(matchBestTime({ ...info, venue_lon: undefined, venue_lng: -71.0602 }, input)?.confidence).toBe("strong");
    expect(matchBestTime({ ...info, venue_lat: 42.351, venue_lon: -71.06 }, input)?.confidence).toBe("weak");
    expect(matchBestTime({ ...info, venue_lon: undefined }, input)).toBeNull();
  });
  it("keeps live separate and permits values above 100 only when available", () => {
    expect(mapBestTimeLive({ status: "OK", venue_info: info, analysis: { venue_live_busyness_available: true, venue_live_busyness: 180 } }, input)?.busyness).toBe(180);
    expect(mapBestTimeLive({ status: "OK", venue_info: info, analysis: { venue_live_busyness_available: false } }, input)?.busyness).toBeUndefined();
  });
});

const PRI = `pri_${"a1".repeat(16)}`;
const PUB = `pub_${"b2".repeat(16)}`;

describe("key configuration", () => {
  it("prefers BESTTIME_PRIVATE_API_KEY and falls back to BESTPLACES_API_KEY only for a pri_ key", () => {
    expect(bestTimeKeyStatus({ BESTTIME_PRIVATE_API_KEY: PRI, BESTPLACES_API_KEY: PUB })).toEqual({ privateKey: "ok", publicKey: "ok" });
    expect(bestTimeConfigured({ BESTPLACES_API_KEY: ` ${PRI} ` })).toBe(true);
    expect(bestTimeKeyStatus({ BESTPLACES_API_KEY: PRI })).toEqual({ privateKey: "ok", publicKey: "missing" });
    expect(bestTimeKeyStatus({ BESTPLACES_API_KEY: PUB })).toEqual({ privateKey: "missing", publicKey: "ok" });
    for (const unrelated of ["sk_live_abc123", "pri_", "pri_has space", `"${PRI}"`, "AIzaSyExample"]) {
      expect(bestTimeKeyStatus({ BESTPLACES_API_KEY: unrelated })).toEqual({ privateKey: "missing", publicKey: "missing" });
    }
    expect(bestTimeConfigured({})).toBe(false);
  });
  it("reports a wrong preferred value instead of masking it with the legacy key", () => {
    expect(bestTimeKeyStatus({ BESTTIME_PRIVATE_API_KEY: PUB, BESTPLACES_API_KEY: PRI }).privateKey).toBe("wrong_type");
    expect(bestTimeKeyStatus({ BESTTIME_PRIVATE_API_KEY: "not-a-key", BESTPLACES_API_KEY: PRI }).privateKey).toBe("invalid");
    expect(bestTimeKeyStatus({ BESTTIME_PUBLIC_API_KEY: PRI }).publicKey).toBe("wrong_type");
    expect(bestTimeConfigured({ BESTTIME_PRIVATE_API_KEY: PUB, BESTPLACES_API_KEY: PRI })).toBe(false);
    expect(JSON.stringify(bestTimeKeyStatus({ BESTTIME_PRIVATE_API_KEY: PRI, BESTTIME_PUBLIC_API_KEY: PUB }))).not.toMatch(/a1a1|b2b2/);
  });
  it("uses the legacy pri_ key upstream, but never a pub_ key (no request at all)", async () => {
    vi.stubEnv("BESTTIME_PRIVATE_API_KEY", ""); vi.stubEnv("BESTPLACES_API_KEY", PRI);
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(requestBestTime("live", input)).rejects.toThrow("BestTime request failed");
    expect((fetcher.mock.calls[0][0] as URL).searchParams.get("api_key_private")).toBe(PRI);
    fetcher.mockClear();
    vi.stubEnv("BESTPLACES_API_KEY", PUB);
    await expect(requestBestTime("forecast", input)).rejects.toThrow("BestTime is not configured.");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("upstream request", () => {
  it("POSTs only to fixed HTTPS host with private key server-side and redacts upstream errors", async () => {
    vi.stubEnv("BESTTIME_PRIVATE_API_KEY", "pri_secret");
    const fetcher = vi.fn().mockResolvedValue(new Response("pri_secret failed", { status: 403 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(requestBestTime("forecast", input)).rejects.toThrow("BestTime request failed");
    const [url, options] = fetcher.mock.calls[0] as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://besttime.app/api/v1/forecasts");
    expect(options.redirect).toBe("error");
    expect(options.cache).toBe("no-store");
    expect(url.searchParams.get("api_key_private")).toBe("pri_secret");
    expect(url.search).not.toContain("Google");
    expect(options.body).toBeUndefined();
  });
});
