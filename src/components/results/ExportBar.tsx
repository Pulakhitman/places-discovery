"use client";

import { useState } from "react";
import { downloadTextFile } from "@/lib/places/download";
import { googleIdsToExport, toGooglePlaceIds, type GoogleIdsFormat } from "@/lib/places/export-google-ids";
import { overtureToExport, toOvertureExportRows, type OvertureFormat } from "@/lib/places/export-overture";
import {
  placesToExport,
  toOsmExportRows,
  type ExportFormat,
} from "@/lib/places/export-osm";
import type { OsmPlace } from "@/lib/places/types";

type Props = {
  places: OsmPlace[];
  label?: string;
};

export function ExportBar({ places, label = "Export (OSM only)" }: Props) {
  const exportableCount = toOsmExportRows(places).length;
  const overtureCount = toOvertureExportRows(places).length;
  const googleOnlyCount = places.filter((p) => p.source === "google").length;
  const disabled = exportableCount === 0;
  const googleIdCount = toGooglePlaceIds(places).length;
  const [flash, setFlash] = useState<string | null>(null);

  function exportAs(format: ExportFormat) {
    if (disabled) return;
    const file = placesToExport(places, format);
    downloadTextFile(file);
    setFlash(`Downloaded ${file.filename}`);
    window.setTimeout(() => setFlash(null), 2500);
  }

  function exportOverture(format: OvertureFormat) {
    if (!overtureCount) return;
    const file = overtureToExport(places, format);
    downloadTextFile(file);
    setFlash(`Downloaded ${file.filename}`);
    window.setTimeout(() => setFlash(null), 2500);
  }

  function exportGoogleIds(format: GoogleIdsFormat) {
    if (!googleIdCount) return;
    const file = googleIdsToExport(places, format);
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
        {exportableCount} OSM record{exportableCount === 1 ? "" : "s"} exportable · {overtureCount} Overture record{overtureCount === 1 ? "" : "s"} exportable separately
        {googleOnlyCount > 0 ? ` · ${googleOnlyCount} Google-only row${googleOnlyCount === 1 ? "" : "s"} excluded` : ""}
        {" · Google, Foursquare and BestTime fields are never exported"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Export formats">
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
        <ExportButton
          label="GeoJSON"
          disabled={disabled}
          onClick={() => exportAs("geojson")}
        />
      </div>
      <div className="mt-3 border-t border-[var(--line)] pt-3">
        <p className="text-xs font-semibold text-[var(--ink)]">Overture Places · {overtureCount}</p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">Separate Overture-only export. Includes release, upstream source datasets and per-source licenses; excludes OSM, Google, Foursquare API and BestTime.</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Overture downloads">
          <ExportButton label="Overture CSV" disabled={overtureCount === 0} onClick={() => exportOverture("csv")} />
          <ExportButton label="Overture JSON" disabled={overtureCount === 0} onClick={() => exportOverture("json")} />
          <ExportButton label="Overture GeoJSON" disabled={overtureCount === 0} onClick={() => exportOverture("geojson")} />
        </div>
      </div>
      <div className="mt-3 border-t border-[var(--line)] pt-3">
        <p className="text-xs font-semibold text-[var(--ink)]">Google Place IDs only · {googleIdCount}</p>
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          Separate ID-only download for Google and Both results. No Google names,
          coordinates, addresses, ratings or reviews are included. Place ID storage
          is permitted; check your Google agreement before redistributing IDs.
        </p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Google Place ID downloads">
          <ExportButton label="Google IDs CSV" disabled={googleIdCount === 0} onClick={() => exportGoogleIds("csv")} />
          <ExportButton label="Google IDs JSON" disabled={googleIdCount === 0} onClick={() => exportGoogleIds("json")} />
        </div>
      </div>
      <p
        className="mt-2 min-h-[1rem] text-[11px] font-medium text-[var(--accent)]"
        role="status"
        aria-live="polite"
      >
        {flash ?? (disabled && googleIdCount === 0 && overtureCount === 0 ? "No places to export (clear filters or search again)." : "\u00a0")}
      </p>
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
