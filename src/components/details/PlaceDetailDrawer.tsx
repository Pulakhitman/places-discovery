"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type {
  GoogleLookupResponse,
  GooglePlaceDetails,
  GoogleStatusResponse,
} from "@/lib/places/google-types";
import {
  formatDistance,
  formatLatLng,
  osmBrowseUrl,
} from "@/lib/places/format";
import type { OsmPlace } from "@/lib/places/types";
import { CategoryIcon } from "@/lib/search/category-icons";

type GoogleState =
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | { status: "empty"; message: string }
  | { status: "error"; message: string; retryable: boolean }
  | { status: "ok"; details: GooglePlaceDetails };

type Props = {
  place: OsmPlace | null;
  open: boolean;
  onClose: () => void;
};

export function PlaceDetailDrawer({ place, open, onClose }: Props) {
  if (!open || !place) {
    return null;
  }

  return (
    <PlaceDetailDrawerInner key={place.id} place={place} onClose={onClose} />
  );
}

function PlaceDetailDrawerInner({
  place,
  onClose,
}: {
  place: OsmPlace;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [google, setGoogle] = useState<GoogleState>({ status: "loading" });
  const [configuredHint, setConfiguredHint] = useState<string | null>(null);

  const retryGoogle = useCallback(() => {
    setGoogle({ status: "loading" });
    setRetryNonce((n) => n + 1);
  }, []);

  useEffect(() => {
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
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/places/google/status");
        const data = (await res.json()) as GoogleStatusResponse;
        if (!cancelled) {
          setConfiguredHint(data.message);
        }
      } catch {
        if (!cancelled) {
          setConfiguredHint(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const res = await fetch("/api/places/google/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: place.name,
            lat: place.lat,
            lng: place.lng,
            radiusM: 500,
          }),
          signal: controller.signal,
        });
        const data = (await res.json()) as GoogleLookupResponse;
        if (cancelled) {
          return;
        }
        if (data.status === "ok") {
          setGoogle({ status: "ok", details: data.details });
          return;
        }
        if (data.status === "unavailable") {
          setGoogle({ status: "unavailable", message: data.message });
          return;
        }
        if (data.status === "empty") {
          setGoogle({ status: "empty", message: data.message });
          return;
        }
        setGoogle({
          status: "error",
          message: data.message,
          retryable: data.retryable,
        });
      } catch (err) {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        setGoogle({
          status: "error",
          message: "Could not reach Google Places.",
          retryable: true,
        });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [place.name, place.lat, place.lng, retryNonce]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex justify-end bg-black/25"
      role="presentation"
      onClick={onClose}
    >
      <aside
        className="flex h-full w-full max-w-md flex-col border-l border-[var(--line)] bg-[var(--surface)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-[var(--line)] px-4 py-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--accent)] ring-1 ring-[var(--line)]">
            <CategoryIcon category={place.categoryId} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="truncate text-lg font-semibold text-[var(--ink)]"
            >
              {place.name}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              {place.categoryLabel} · {formatDistance(place.distanceM)} · OSM
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

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <section aria-labelledby="osm-section">
            <h3
              id="osm-section"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
              OpenStreetMap
            </h3>
            <dl className="mt-2 space-y-2 text-sm">
              <Row label="Address" value={place.address} />
              <Row label="Hours" value={place.hours} />
              <Row label="Website" value={place.website} link />
              <Row label="Phone" value={place.phone} />
              <Row
                label="Coordinates"
                value={formatLatLng(place.lat, place.lng)}
              />
            </dl>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
              <span>© OpenStreetMap contributors · ODbL</span>
              <a
                href={osmBrowseUrl(place.osmType, place.osmId)}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
              >
                View on openstreetmap.org
              </a>
              <CopyButton
                label="Copy coords"
                value={formatLatLng(place.lat, place.lng, 6)}
              />
            </p>
          </section>

          <section aria-labelledby="google-section">
            <h3
              id="google-section"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
              Google Places
            </h3>

            {google.status === "loading" && (
              <p className="mt-2 text-sm text-[var(--muted)]" role="status">
                Looking up hours, ratings, and reviews…
              </p>
            )}

            {google.status === "unavailable" && (
              <p
                className="mt-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--muted)]"
                role="status"
              >
                {google.message}
                {configuredHint ? (
                  <span className="mt-1 block text-xs">{configuredHint}</span>
                ) : null}
              </p>
            )}

            {google.status === "empty" && (
              <p className="mt-2 text-sm text-[var(--muted)]" role="status">
                {google.message}
              </p>
            )}

            {google.status === "error" && (
              <div className="mt-2" role="alert">
                <p className="text-sm text-[var(--danger)]">{google.message}</p>
                {google.retryable ? (
                  <button
                    type="button"
                    className="mt-2 text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                    onClick={retryGoogle}
                  >
                    Retry Google lookup
                  </button>
                ) : null}
              </div>
            )}

            {google.status === "ok" && (
              <GoogleDetailsBlock details={google.details} />
            )}
          </section>

          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            Google content is display-only with required attribution and is
            never included in exports. Official Places API only — no scraping.
            Press Esc to close.
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  link,
}: {
  label: string;
  value?: string;
  link?: boolean;
}) {
  return (
    <div>
      <dt className="inline font-medium text-[var(--ink)]">{label}: </dt>
      <dd className="inline text-[var(--muted)]">
        {value ? (
          link ? (
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          "Not tagged"
        )}
      </dd>
    </div>
  );
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function GoogleDetailsBlock({ details }: { details: GooglePlaceDetails }) {
  return (
    <div className="mt-2 space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        {typeof details.rating === "number" ? (
          <p className="font-semibold text-[var(--ink)]">
            ★ {details.rating.toFixed(1)}
            {typeof details.userRatingCount === "number" ? (
              <span className="ml-1 font-normal text-[var(--muted)]">
                ({details.userRatingCount.toLocaleString()} reviews)
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-[var(--muted)]">No rating available</p>
        )}
        {details.googleMapsUri ? (
          <a
            href={details.googleMapsUri}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--accent)] underline-offset-2 hover:underline"
          >
            Open in Google Maps
          </a>
        ) : null}
      </div>

      <dl className="space-y-2 text-sm">
        <Row label="Address" value={details.address} />
        <Row label="Phone" value={details.phone} />
        <Row label="Website" value={details.website} link />
      </dl>

      {details.hoursWeekday && details.hoursWeekday.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">Hours</p>
          <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
            {details.hoursWeekday.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {details.photos.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">Photos</p>
          <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {details.photos.map((photo) => (
              <li key={photo.name} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.mediaUrl}
                  alt=""
                  className="h-24 w-32 rounded-md object-cover ring-1 ring-[var(--line)]"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {details.reviews.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">Reviews</p>
          <ul className="mt-2 space-y-3">
            {details.reviews.map((review, index) => (
              <li
                key={`${review.authorName ?? "r"}-${index}`}
                className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/60 px-3 py-2 text-sm"
              >
                <p className="text-xs text-[var(--muted)]">
                  {typeof review.rating === "number"
                    ? `★ ${review.rating}`
                    : "Review"}
                  {review.authorName ? ` · ${review.authorName}` : ""}
                  {review.relativeTime ? ` · ${review.relativeTime}` : ""}
                </p>
                {review.text ? (
                  <p className="mt-1 text-[var(--ink)]">{review.text}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">No reviews returned.</p>
      )}

      <p className="text-[11px] text-[var(--muted)]">
        {details.attribution} · display only
      </p>
    </div>
  );
}
