import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGoogleUsageSnapshot,
  recordGoogleUsage,
  resetGoogleUsageForTests,
} from "./google-usage";

describe("google-usage", () => {
  beforeEach(() => {
    resetGoogleUsageForTests();
    vi.stubEnv("GOOGLE_PLACES_DAILY_BUDGET_USD", "");
  });

  it("counts calls and estimates cost", () => {
    recordGoogleUsage("text_search");
    recordGoogleUsage("place_details");
    recordGoogleUsage("place_details");
    const snap = getGoogleUsageSnapshot();
    expect(snap.counts.text_search).toBe(1);
    expect(snap.counts.place_details).toBe(2);
    expect(snap.totalCalls).toBe(3);
    expect(snap.estimatedUsd).toBeGreaterThan(0);
  });

  it("warns near soft budget", () => {
    vi.stubEnv("GOOGLE_PLACES_DAILY_BUDGET_USD", "0.05");
    for (let i = 0; i < 3; i += 1) {
      recordGoogleUsage("place_details");
    }
    const snap = getGoogleUsageSnapshot();
    expect(snap.warn).toBe(true);
    expect(snap.budgetPct).toBeGreaterThanOrEqual(80);
  });
});
