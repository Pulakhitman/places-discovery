import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get: () => undefined })) }));
vi.mock("@/lib/providers/besttime", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/providers/besttime")>();
  return { ...original, requestBestTime: vi.fn() };
});

import { POST } from "./route";
import { requestBestTime } from "@/lib/providers/besttime";

const venue = { id: "osm:node/1", source: "osm", sources: { osm: true }, isUnnamed: false,
  name: "Central Cafe", address: "10 Main St, Boston", lat: 42.35, lng: -71.06,
  tags: { "addr:housenumber": "10", "addr:street": "Main St" } };
function post(body: unknown): Request {
  return new Request("http://localhost/api/places/besttime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("BestTime POST", () => {
  it("rejects locked users before any paid call", async () => {
    vi.stubEnv("ACCESS_KEY", "secret"); vi.stubEnv("BESTTIME_PRIVATE_API_KEY", "pri_secret");
    const response = await POST(post({ ...venue, action: "forecast" }));
    expect(response.status).toBe(401);
    expect(requestBestTime).not.toHaveBeenCalled();
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects Google and imprecise addresses without a paid call", async () => {
    vi.stubEnv("ACCESS_KEY", ""); vi.stubEnv("BESTTIME_PRIVATE_API_KEY", "pri_secret");
    expect((await POST(post({ ...venue, action: "forecast", sources: { google: true, osm: true } }))).status).toBe(400);
    expect((await POST(post({ ...venue, action: "live", tags: { "addr:city": "Boston" } }))).status).toBe(400);
    expect(requestBestTime).not.toHaveBeenCalled();
  });
  it("never returns upstream errors or secrets", async () => {
    vi.stubEnv("ACCESS_KEY", ""); vi.stubEnv("BESTTIME_PRIVATE_API_KEY", "pri_secret");
    vi.mocked(requestBestTime).mockRejectedValueOnce(new Error("pri_secret upstream error"));
    const response = await POST(post({ ...venue, action: "forecast" }));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("pri_secret");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
