"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  GoogleLookupResponse,
  GoogleMatchInfo,
  GooglePlaceDetails,
  GooglePlaceReview,
  GoogleStatusResponse,
} from "@/lib/places/google-types";
import {
  formatDistance,
  formatLatLng,
  osmBrowseUrl,
} from "@/lib/places/format";
import {
  readSessionGooglePlace,
  writeSessionGooglePlace,
} from "@/lib/places/google-session-place";
import { placesResourceName } from "@/lib/places/google-ids";
import {
  skimGoogleReviews,
  type ReviewSkimMinStars,
  type ReviewSkimSort,
} from "@/lib/places/review-skim";
import type { OsmPlace } from "@/lib/places/types";
import { CategoryIcon } from "@/lib/search/category-icons";

type GoogleState =
  | { status: "loading" }
  | { status: "unavailable"; message: string }
  | { status: "empty"; message: string }
  | { status: "error"; message: string; retryable: boolean }
  | { status: "ok"; details: GooglePlaceDetails; match: GoogleMatchInfo };

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
  const [acceptedWeakMatch, setAcceptedWeakMatch] = useState(false);

  const retryGoogle = useCallback(() => {
    setGoogle({ status: "loading" });
    setAcceptedWeakMatch(false);
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
        // Phase 3: reuse session placeId (no Text Search) when we already matched.
        const cached = readSessionGooglePlace(place.id);
        if (cached?.placeId) {
          const res = await fetch(
            `/api/places/google/${encodeURIComponent(cached.placeId)}`,
            { signal: controller.signal },
          );
          const data = (await res.json()) as GoogleLookupResponse;
          if (cancelled) {
            return;
          }
          if (data.status === "ok") {
            setGoogle({
              status: "ok",
              details: data.details,
              match: cached.match,
            });
            setAcceptedWeakMatch(cached.match.confidence === "strong");
            return;
          }
          // Stale id — fall through to name lookup.
        }

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
          const match = data.match ?? {
            confidence: "strong" as const,
            distanceM: 0,
            nameSimilarity: 1,
            queriedName: place.name,
            googleName: data.details.name,
          };
          writeSessionGooglePlace(place.id, {
            placeId: data.details.placeId,
            googleName: data.details.name,
            match,
          });
          setGoogle({
            status: "ok",
            details: data.details,
            match,
          });
          setAcceptedWeakMatch(match.confidence === "strong");
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
  }, [place.id, place.name, place.lat, place.lng, retryNonce]);

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
              <GoogleDetailsBlock
                details={google.details}
                match={google.match}
                osmName={place.name}
                acceptedWeakMatch={acceptedWeakMatch}
                onAcceptWeakMatch={() => setAcceptedWeakMatch(true)}
              />
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

function GoogleIdsBlock({ details }: { details: GooglePlaceDetails }) {
  const resource = placesResourceName(details.placeId);
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/70 px-3 py-2">
      <p className="text-sm font-medium text-[var(--ink)]">Google IDs</p>
      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
        From Places API (New) only — display / copy; never exported. No SerpAPI
        or scrapers.
      </p>
      <ul className="mt-2 space-y-2 text-sm">
        <IdCopyRow
          label="place_id"
          value={details.placeId}
          hint="Primary Places API id (ChIJ…)"
        />
        {resource ? (
          <IdCopyRow
            label="resource name"
            value={resource}
            hint="places/… form used by the API"
          />
        ) : null}
        {details.mapsCid ? (
          <IdCopyRow
            label="CID"
            value={details.mapsCid}
            hint="Parsed from googleMapsUri ?cid= when present"
          />
        ) : (
          <li className="text-xs text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">CID: </span>
            Not in this response
            {details.googleMapsUri
              ? " (Maps link has no ?cid=)"
              : " (no googleMapsUri)"}
          </li>
        )}
        <li className="text-xs text-[var(--muted)]">
          <span className="font-medium text-[var(--ink)]">data_id: </span>
          N/A from official Places API (New) — scrape-style{" "}
          <code className="text-[10px]">0x…:0x…</code> ids are not returned
          here.
        </li>
      </ul>
    </div>
  );
}

function IdCopyRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1">
          <span className="text-xs font-medium text-[var(--ink)]">{label}</span>
          {hint ? (
            <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
              {hint}
            </span>
          ) : null}
          <code className="mt-1 block break-all rounded bg-[var(--surface)] px-1.5 py-1 text-[11px] text-[var(--ink)] ring-1 ring-[var(--line)]">
            {value}
          </code>
        </p>
        <CopyButton label="Copy" value={value} />
      </div>
    </li>
  );
}

function visitLabel(review: GooglePlaceReview): string | null {
  if (review.visitDateMonth && review.visitDateYear) {
    return `Visited ${review.visitDateMonth}/${review.visitDateYear}`;
  }
  return null;
}

function GoogleDetailsBlock({
  details,
  match,
  osmName,
  acceptedWeakMatch,
  onAcceptWeakMatch,
}: {
  details: GooglePlaceDetails;
  match: GoogleMatchInfo;
  osmName: string;
  acceptedWeakMatch: boolean;
  onAcceptWeakMatch: () => void;
}) {
  const showRich =
    match.confidence === "strong" || acceptedWeakMatch;
  const [minStars, setMinStars] = useState<ReviewSkimMinStars>(0);
  const [sort, setSort] = useState<ReviewSkimSort>("relevance");
  const visibleReviews = useMemo(
    () => skimGoogleReviews(details.reviews, { minStars, sort }),
    [details.reviews, minStars, sort],
  );

  return (
    <div className="mt-2 space-y-3">
      <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
        <p className="font-medium text-[var(--ink)]" translate="no">
          Google Maps match
        </p>
        <p className="mt-1 text-sm text-[var(--ink)]">
          <span className="font-semibold">{details.name}</span>
          {details.name !== osmName ? (
            <span className="font-normal text-[var(--muted)]">
              {" "}
              (OSM: {osmName})
            </span>
          ) : null}
        </p>
        <p className="mt-0.5">
          {formatDistance(match.distanceM)} from pin · name similarity{" "}
          {Math.round(match.nameSimilarity * 100)}% ·{" "}
          <span
            className={
              match.confidence === "strong"
                ? "font-semibold text-[var(--accent)]"
                : "font-semibold text-[var(--danger)]"
            }
          >
            {match.confidence} match
          </span>
        </p>
        {match.confidence === "weak" && !acceptedWeakMatch ? (
          <div className="mt-2 space-y-2">
            <p>
              This Google place may not be the same as the OSM result. Confirm
              before loading photos and reviews.
            </p>
            <button
              type="button"
              className="btn-primary text-xs"
              onClick={onAcceptWeakMatch}
            >
              Use this Google match
            </button>
          </div>
        ) : null}
      </div>

      {!showRich ? (
        <p className="text-sm text-[var(--muted)]">
          Confirm the match above to show Google hours, photos, and reviews.
        </p>
      ) : (
        <>
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

          <GoogleIdsBlock details={details} />

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
              <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {details.photos.map((photo) => (
                  <li key={photo.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.mediaUrl}
                      alt=""
                      className="aspect-[4/3] w-full rounded-md object-cover ring-1 ring-[var(--line)]"
                      loading="lazy"
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {details.reviewSummary?.text ? (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/80 px-3 py-2">
              <p className="text-sm font-medium text-[var(--ink)]">
                Google review summary
              </p>
              <p className="mt-1 text-sm text-[var(--ink)]">
                {details.reviewSummary.text}
              </p>
              <p className="mt-2 text-[11px] text-[var(--muted)]" translate="no">
                {details.reviewSummary.disclosureText
                  ? `${details.reviewSummary.disclosureText} · `
                  : ""}
                Official Places reviewSummary · shown verbatim · not written by
                this app
              </p>
            </div>
          ) : null}

          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-[var(--ink)]">
                Reviews
                {details.reviews.length > 0
                  ? ` (${details.reviews.length}${
                      typeof details.userRatingCount === "number"
                        ? ` of ${details.userRatingCount.toLocaleString()}`
                        : ""
                    })`
                  : ""}
              </p>
              {details.googleMapsUri ? (
                <a
                  href={details.googleMapsUri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  Read all on Google Maps
                </a>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-[var(--muted)]">
              Sample Google returned (max 5) — skim locally; not a full list or
              scrape.
            </p>
            {details.reviews.length > 0 ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <label className="flex items-center gap-1 text-[var(--muted)]">
                    Min stars
                    <select
                      className="field py-1 text-xs"
                      value={minStars}
                      onChange={(e) =>
                        setMinStars(Number(e.target.value) as ReviewSkimMinStars)
                      }
                    >
                      <option value={0}>Any</option>
                      <option value={4}>★★★★+</option>
                      <option value={5}>★★★★★</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1 text-[var(--muted)]">
                    Sort
                    <select
                      className="field py-1 text-xs"
                      value={sort}
                      onChange={(e) =>
                        setSort(e.target.value as ReviewSkimSort)
                      }
                    >
                      <option value="relevance">Relevance</option>
                      <option value="rating">Highest rating</option>
                      <option value="newest">Newest</option>
                    </select>
                  </label>
                </div>
                {visibleReviews.length > 0 ? (
                  <ul className="mt-2 space-y-3">
                    {visibleReviews.map((review, index) => (
                      <li
                        key={`${review.authorName ?? "r"}-${review.publishTime ?? index}`}
                        className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/60 px-3 py-2 text-sm"
                      >
                        <div className="flex items-start gap-2">
                          {review.authorPhotoUri ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={review.authorPhotoUri}
                              alt=""
                              className="mt-0.5 h-8 w-8 rounded-full object-cover ring-1 ring-[var(--line)]"
                              loading="lazy"
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-[var(--muted)]">
                              {typeof review.rating === "number"
                                ? `★ ${review.rating}`
                                : "Review"}
                              {review.authorName ? (
                                <>
                                  {" · "}
                                  {review.authorUri ? (
                                    <a
                                      href={review.authorUri}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[var(--accent)] underline-offset-2 hover:underline"
                                    >
                                      {review.authorName}
                                    </a>
                                  ) : (
                                    review.authorName
                                  )}
                                </>
                              ) : null}
                              {review.relativeTime
                                ? ` · ${review.relativeTime}`
                                : ""}
                              {visitLabel(review)
                                ? ` · ${visitLabel(review)}`
                                : ""}
                            </p>
                            {review.text ? (
                              <p className="mt-1 text-[var(--ink)]">
                                {review.text}
                              </p>
                            ) : null}
                            {review.originalText &&
                            review.originalText !== review.text ? (
                              <p className="mt-1 text-xs text-[var(--muted)]">
                                Original: {review.originalText}
                              </p>
                            ) : null}
                            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                              {review.googleMapsUri ? (
                                <a
                                  href={review.googleMapsUri}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--accent)] underline-offset-2 hover:underline"
                                >
                                  View on Google Maps
                                </a>
                              ) : null}
                              {review.flagContentUri ? (
                                <a
                                  href={review.flagContentUri}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--muted)] underline-offset-2 hover:underline"
                                >
                                  Report
                                </a>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    No reviews match this skim — try Any stars.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No review sample from Places API.
              </p>
            )}
          </div>
        </>
      )}

      <p className="text-[11px] text-[var(--muted)]" translate="no">
        {details.attribution} · display only · never exported · official API
        only
      </p>
    </div>
  );
}
