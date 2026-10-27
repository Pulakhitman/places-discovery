import type { FieldCoverage, OsmPlace } from "./types";

function pct(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.round((part / total) * 100);
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
