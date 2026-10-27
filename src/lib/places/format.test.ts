import { describe, expect, it } from "vitest";
import { normalizeHttpUrl, websiteHref } from "./format";

describe("normalizeHttpUrl", () => {
  it("keeps absolute http(s) URLs", () => {
    expect(normalizeHttpUrl("https://example.org/a")).toBe(
      "https://example.org/a",
    );
    expect(normalizeHttpUrl("http://example.org")).toBe("http://example.org");
  });

  it("adds https for bare hosts and www", () => {
    expect(normalizeHttpUrl("example.org")).toBe("https://example.org");
    expect(normalizeHttpUrl("www.example.org/path")).toBe(
      "https://www.example.org/path",
    );
  });

  it("handles protocol-relative URLs", () => {
    expect(normalizeHttpUrl("//cdn.example.org")).toBe("https://cdn.example.org");
  });

  it("rejects values that are not host-like", () => {
    expect(normalizeHttpUrl("not a url")).toBeUndefined();
    expect(normalizeHttpUrl("")).toBeUndefined();
    expect(normalizeHttpUrl(undefined)).toBeUndefined();
  });
});

describe("websiteHref", () => {
  it("falls back to raw when normalize fails but value exists", () => {
    expect(websiteHref("https://ok.test")).toBe("https://ok.test");
  });
});
