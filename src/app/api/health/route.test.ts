import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: vi.fn(async () => undefined) }));

import { connection } from "next/server";
import { GET } from "./route";

const PRI = `pri_${"c3".repeat(16)}`;
const PUB = `pub_${"d4".repeat(16)}`;
function stubBestTimeEnv(env: { BESTTIME_PRIVATE_API_KEY?: string; BESTTIME_PUBLIC_API_KEY?: string; BESTPLACES_API_KEY?: string }) {
  for (const name of ["BESTTIME_PRIVATE_API_KEY", "BESTTIME_PUBLIC_API_KEY", "BESTPLACES_API_KEY"] as const) vi.stubEnv(name, env[name] ?? "");
}
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("GET /api/health", () => {
  it("reads env at request time and reports a pri_ BESTPLACES_API_KEY as configured without exposing it", async () => {
    stubBestTimeEnv({ BESTPLACES_API_KEY: PRI });
    const text = await (await GET()).text();
    expect(connection).toHaveBeenCalledOnce();
    expect(JSON.parse(text)).toMatchObject({ ok: true, bestTimeConfigured: true, bestTimeKeyStatus: { privateKey: "ok", publicKey: "missing" } });
    expect(text).not.toContain("c3c3");
  });
  it("distinguishes a public-key-only setup and a public key in the private slot", async () => {
    stubBestTimeEnv({ BESTPLACES_API_KEY: PUB });
    expect(await (await GET()).json()).toMatchObject({ bestTimeConfigured: false, bestTimeKeyStatus: { privateKey: "missing", publicKey: "ok" } });
    stubBestTimeEnv({ BESTTIME_PRIVATE_API_KEY: PUB });
    const text = await (await GET()).text();
    expect(JSON.parse(text)).toMatchObject({ bestTimeConfigured: false, bestTimeKeyStatus: { privateKey: "wrong_type", publicKey: "missing" } });
    expect(text).not.toContain("d4d4");
  });
});
