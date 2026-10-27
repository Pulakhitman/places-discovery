import { describe, expect, it } from "vitest";
import { extractCidFromMapsUri, placesResourceName } from "./google-ids";

describe("google-ids", () => {
  it("extracts CID from Maps URIs", () => {
    expect(
      extractCidFromMapsUri("https://maps.google.com/?cid=12345678901234567890"),
    ).toBe("12345678901234567890");
    expect(
      extractCidFromMapsUri(
        "https://www.google.com/maps?cid=999&hl=en",
      ),
    ).toBe("999");
  });

  it("returns null when no CID is present", () => {
    expect(
      extractCidFromMapsUri(
        "https://maps.google.com/?q=place_id:ChIJtest",
      ),
    ).toBeNull();
    expect(extractCidFromMapsUri(undefined)).toBeNull();
  });

  it("formats Places resource names", () => {
    expect(placesResourceName("ChIJabc")).toBe("places/ChIJabc");
    expect(placesResourceName("places/ChIJabc")).toBe("places/ChIJabc");
  });
});
