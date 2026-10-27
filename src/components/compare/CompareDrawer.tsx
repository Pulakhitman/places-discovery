"use client";

import { useEffect, useId, useRef } from "react";
import type { OsmPlace } from "@/lib/places/types";
import { CategoryIcon } from "@/lib/search/category-icons";

type Props = {
  places: OsmPlace[];
  open: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
};

function formatDistance(m: number): string {
  if (m < 1000) {
    return `${m} m`;
  }
  return `${(m / 1000).toFixed(1)} km`;
}

const ROWS: { key: keyof OsmPlace | "named"; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "categoryLabel", label: "Category" },
  { key: "distanceM", label: "Distance" },
  { key: "named", label: "Named in OSM" },
  { key: "address", label: "Address" },
  { key: "hours", label: "Hours" },
  { key: "website", label: "Website" },
  { key: "phone", label: "Phone" },
];

function cellValue(place: OsmPlace, key: (typeof ROWS)[number]["key"]): string {
  if (key === "named") {
    return place.isUnnamed ? "No" : "Yes";
  }
  if (key === "distanceM") {
    return formatDistance(place.distanceM);
  }
  const value = place[key];
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return "—";
}

export function CompareDrawer({ places, open, onClose, onRemove }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || places.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/30 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-t-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--ink)]"
            >
              Compare places
            </h2>
            <p className="text-xs text-[var(--muted)]">
              OpenStreetMap fields only · Esc to close
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className="overflow-auto px-2 py-3 sm:px-4">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-[var(--surface)] px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Field
                </th>
                {places.map((place) => (
                  <th
                    key={place.id}
                    className="min-w-[10rem] px-2 py-2 align-bottom"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-[var(--accent)]">
                        <CategoryIcon category={place.categoryId} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[var(--ink)]">
                          {place.name}
                        </p>
                        <button
                          type="button"
                          className="text-[11px] text-[var(--muted)] underline-offset-2 hover:underline"
                          onClick={() => onRemove(place.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} className="border-t border-[var(--line)]">
                  <th className="sticky left-0 bg-[var(--surface)] px-2 py-2 text-xs font-medium text-[var(--muted)]">
                    {row.label}
                  </th>
                  {places.map((place) => {
                    const value = cellValue(place, row.key);
                    const isLink =
                      row.key === "website" && value.startsWith("http");
                    return (
                      <td
                        key={`${place.id}-${row.key}`}
                        className="px-2 py-2 text-[var(--ink)]"
                      >
                        {isLink ? (
                          <a
                            href={value}
                            target="_blank"
                            rel="noreferrer"
                            className="break-all text-[var(--accent)] underline-offset-2 hover:underline"
                          >
                            {value}
                          </a>
                        ) : (
                          <span className="break-words">{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="border-t border-[var(--line)] px-4 py-2 text-[11px] text-[var(--muted)]">
          © OpenStreetMap contributors · ODbL · Google fields are not shown in
          compare
        </footer>
      </div>
    </div>
  );
}
