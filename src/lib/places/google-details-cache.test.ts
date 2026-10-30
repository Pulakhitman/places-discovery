import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Guard the paid Details request against reintroducing a cache of Places content.
describe("Google details retention", () => {
  it("does not use a server-side details cache", () => {
    const provider = readFileSync(new URL("../providers/google-places.ts", import.meta.url), "utf8");
    expect(provider).not.toMatch(/google-details-cache|setCachedGoogleDetails|getCachedGoogleDetails/);
  });
});
