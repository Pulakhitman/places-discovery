import type { FieldCoverage, OsmPlace } from "./types";

function pct(part: number, total: number): number {
  if (total <= 0 || part <= 0) {
    return 0;
  }
  const rounded = Math.round((part / total) * 100);
  // Keep a visible 1% when at least one place is tagged but the share rounds to 0.
  return rounded === 0 ? 1 : rounded;
}

export function computeOsmCoverage(places: OsmPlace[]): FieldCoverage {
  const total = places.length;
  let withHours = 0;
  let withWebsite = 0;
  let withPhone = 0;
  let withAddress = 0;

  for (const p of places) {
    if (p.hours) {
      withHours += 1;
    }
    if (p.website) {
      withWebsite += 1;
    }
    if (p.phone) {
      withPhone += 1;
    }
    if (p.address) {
      withAddress += 1;
    }
  }

  return {
    total,
    withHours,
    withWebsite,
    withPhone,
    withAddress,
    hoursPct: pct(withHours, total),
    websitePct: pct(withWebsite, total),
    phonePct: pct(withPhone, total),
    addressPct: pct(withAddress, total),
  };
}
