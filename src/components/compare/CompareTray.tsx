"use client";

import type { OsmPlace } from "@/lib/places/types";
import { CategoryIcon } from "@/lib/search/category-icons";

export const MAX_COMPARE = 3;

type Props = {
  places: OsmPlace[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onOpenCompare: () => void;
};

export function CompareTray({
  places,
  onRemove,
  onClear,
  onOpenCompare,
}: Props) {
  if (places.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="compare-tray-heading"
      className="rounded-lg border border-[var(--accent)]/35 bg-[color-mix(in_oklab,var(--accent)_6%,transparent)] px-3 py-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h3
          id="compare-tray-heading"
          className="text-xs font-semibold uppercase tracking-wide text-[var(--ink)]"
        >
          Compare · {places.length}/{MAX_COMPARE}
        </h3>
        <button
          type="button"
          className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:underline"
          onClick={onClear}
        >
          Clear
        </button>
      </div>

      <ul className="mt-2 flex flex-col gap-1.5">
        {places.map((place) => (
          <li
            key={place.id}
            className="flex items-center gap-2 rounded-md bg-[var(--surface)] px-2 py-1.5 text-sm"
          >
            <span className="text-[var(--accent)]">
              <CategoryIcon category={place.categoryId} />
            </span>
            <span className="min-w-0 flex-1 truncate font-medium text-[var(--ink)]">
              {place.name}
            </span>
            <button
              type="button"
              className="text-xs text-[var(--muted)] hover:text-[var(--ink)]"
              aria-label={`Remove ${place.name} from compare`}
              onClick={() => onRemove(place.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn-primary mt-2 w-full !py-2 text-sm"
        disabled={places.length < 2}
        onClick={onOpenCompare}
      >
        {places.length < 2
          ? "Add at least 2 places"
          : `Compare ${places.length} places`}
      </button>
    </section>
  );
}
