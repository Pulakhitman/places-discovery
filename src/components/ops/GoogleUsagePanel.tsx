"use client";

import { useCallback, useEffect, useState } from "react";
import type { GoogleUsageSnapshot } from "@/lib/places/google-usage";

type UsageResponse = GoogleUsageSnapshot & {
  configured: boolean;
  disclaimer: string;
};

type Props = {
  /** Bump to refetch after opening Google details. */
  refreshKey?: number;
};

export function GoogleUsagePanel({ refreshKey = 0 }: Props) {
  const [data, setData] = useState<UsageResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/places/google/usage");
      if (!res.ok) {
        return;
      }
      setData((await res.json()) as UsageResponse);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!data || !data.configured) {
    return null;
  }

  return (
    <section
      aria-labelledby="google-usage-heading"
      className={`rounded-lg border px-3 py-2 text-xs ${
        data.warn
          ? "border-[var(--warn)] bg-[color-mix(in_oklab,var(--warn)_10%,transparent)] text-[var(--ink)]"
          : "border-[var(--line)] bg-[var(--surface-2)]/60 text-[var(--muted)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="google-usage-heading"
          className="text-xs font-semibold uppercase tracking-wide text-[var(--ink)]"
        >
          Places API usage (today UTC)
        </h3>
        <button
          type="button"
          className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      <p className="mt-1 tabular-nums text-[var(--ink)]">
        {data.totalCalls} call{data.totalCalls === 1 ? "" : "s"} · ~$
        {data.estimatedUsd.toFixed(3)} est.
        {data.dailyBudgetUsd != null
          ? ` · soft budget $${data.dailyBudgetUsd.toFixed(2)} (${data.budgetPct ?? 0}%)`
          : ""}
      </p>
      <ul className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5">
        <li>Text search: {data.counts.text_search}</li>
        <li>Nearby: {data.counts.nearby_search}</li>
        <li>Details: {data.counts.place_details}</li>
        <li>Photos: {data.counts.place_photo}</li>
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed">{data.message}</p>
      <p className="mt-1 text-[10px] leading-relaxed opacity-90">
        {data.disclaimer}
      </p>
    </section>
  );
}
