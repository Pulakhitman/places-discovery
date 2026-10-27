import { describe, expect, it } from "vitest";
import { categoryMarkerHtml } from "./category-marker-html";

describe("categoryMarkerHtml", () => {
  it("renders placeholder and result pin classes", () => {
    expect(categoryMarkerHtml("parks")).toContain("map-ph-pin");
    expect(categoryMarkerHtml("parks", "result")).toContain("map-result-pin");
    expect(categoryMarkerHtml("parks", "result-active")).toContain(
      "map-result-pin--active",
    );
    expect(categoryMarkerHtml("parks")).toContain("<svg");
  });
});
