"use client";

import { useState } from "react";
import { downloadTextFile } from "@/lib/places/download";
import {
  placesToExport,
  type ExportFormat,
} from "@/lib/places/export-osm";
import type { OsmPlace } from "@/lib/places/types";

type Props = {
  places: OsmPlace[];
  label?: string;
};

export function ExportBar({ places, label = "Export (OSM only)" }: Props) {
  const disabled = places.length === 0;
  const [flash, setFlash] = useState<string | null>(null);

  function exportAs(format: ExportFormat) {
    if (places.length === 0) {
      return;
    }
    const file = placesToExport(places, format);
    downloadTextFile(file);
    setFlash(`Downloaded ${file.filename}`);
    window.setTimeout(() => setFlash(null), 2500);
  }

  return (
    <section
      aria-labelledby="export-heading"
      className="rounded-lg border border-[var(--line)] px-3 py-2"
    >
      <h3
        id="export-heading"
        className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
      >
        {label}
      </h3>
      <p className="mt-1 text-[11px] text-[var(--muted)]">
        {places.length} place{places.length === 1 ? "" : "s"} · Google
        ratings/reviews are never included.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <ExportButton
          label="CSV"
          disabled={disabled}
          onClick={() => exportAs("csv")}
        />
        <ExportButton
          label="JSON"
          disabled={disabled}
          onClick={() => exportAs("json")}
        />
        <ExportButton
          label="HTML"
          disabled={disabled}
          onClick={() => exportAs("html")}
        />
      </div>
      {flash ? (
        <p className="mt-2 text-[11px] font-medium text-[var(--accent)]" role="status">
          {flash}
        </p>
      ) : null}
    </section>
  );
}

function ExportButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-md border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-45"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
