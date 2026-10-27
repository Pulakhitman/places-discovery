/**
 * In-memory Places API (New) call meter for the running Node process.
 * Soft budget warnings only — not a substitute for Google Cloud billing alerts.
 */

export type GoogleUsageKind =
  | "text_search"
  | "nearby_search"
  | "place_details"
  | "place_photo";

type DayBucket = {
  day: string; // YYYY-MM-DD UTC
  counts: Record<GoogleUsageKind, number>;
};

const EMPTY_COUNTS = (): Record<GoogleUsageKind, number> => ({
  text_search: 0,
  nearby_search: 0,
  place_details: 0,
  place_photo: 0,
});

let bucket: DayBucket = {
  day: utcDay(),
  counts: EMPTY_COUNTS(),
};

function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function rollDay(): void {
  const today = utcDay();
  if (bucket.day !== today) {
    bucket = { day: today, counts: EMPTY_COUNTS() };
  }
}

/** Approximate USD per call (list-price ballpark for Atmosphere Details / search). */
const EST_USD: Record<GoogleUsageKind, number> = {
  text_search: 0.032,
  nearby_search: 0.032,
  place_details: 0.04,
  place_photo: 0.007,
};

export function recordGoogleUsage(kind: GoogleUsageKind): void {
  rollDay();
  bucket.counts[kind] += 1;
}

export function resetGoogleUsageForTests(): void {
  bucket = { day: utcDay(), counts: EMPTY_COUNTS() };
}

export type GoogleUsageSnapshot = {
  day: string;
  counts: Record<GoogleUsageKind, number>;
  totalCalls: number;
  estimatedUsd: number;
  dailyBudgetUsd: number | null;
  budgetPct: number | null;
  warn: boolean;
  message: string;
};

function dailyBudgetUsd(): number | null {
  const raw = process.env.GOOGLE_PLACES_DAILY_BUDGET_USD?.trim();
  if (!raw) {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function getGoogleUsageSnapshot(): GoogleUsageSnapshot {
  rollDay();
  const counts = { ...bucket.counts };
  const totalCalls = Object.values(counts).reduce((a, b) => a + b, 0);
  let estimatedUsd = 0;
  for (const kind of Object.keys(counts) as GoogleUsageKind[]) {
    estimatedUsd += counts[kind] * EST_USD[kind];
  }
  estimatedUsd = Math.round(estimatedUsd * 1000) / 1000;
  const budget = dailyBudgetUsd();
  const budgetPct =
    budget != null && budget > 0
      ? Math.min(999, Math.round((estimatedUsd / budget) * 100))
      : null;
  const warn = budgetPct != null && budgetPct >= 80;
  const message =
    budget == null
      ? "No GOOGLE_PLACES_DAILY_BUDGET_USD set — estimates only. Use Google Cloud budgets for hard limits."
      : warn
        ? `Approaching daily soft budget (~${budgetPct}% of $${budget.toFixed(2)}). Prefer session placeId reuse; avoid opening every result.`
        : `Soft budget $${budget.toFixed(2)}/day UTC — ~${budgetPct ?? 0}% used by estimate.`;

  return {
    day: bucket.day,
    counts,
    totalCalls,
    estimatedUsd,
    dailyBudgetUsd: budget,
    budgetPct,
    warn,
    message,
  };
}
