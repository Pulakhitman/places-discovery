"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  GoogleAiSummary,
  GoogleLookupResponse,
  GoogleMatchInfo,
  GooglePlaceDetails,
  GooglePlaceReview,
  GoogleStatusResponse,
} from "@/lib/places/google-types";
import {
  formatDistance,
  formatLatLng,
  normalizeHttpUrl,
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
import { BESTTIME_SECTION_ID, BestTimePanel, bestTimeBlocker } from "./BestTimePanel";
import {
  FOURSQUARE_SECTION_ID,
  FoursquarePanel,
  foursquareBlocker,
} from "./FoursquarePanel";

/** An OSM-only record: safe to send to Foursquare / BestTime. */
export type OsmSnapshot = OsmPlace & {
  source: "osm";
  osmType: "node" | "way" | "relation";
  osmId: number;
};

const OSM_ROW_ID = /^osm:(node|way|relation)\/(\d+)$/;

/**
 * The OSM record third-party enrichment may use: the row itself for OSM rows,
 * or the original OSM snapshot (`matchedOsm`) for merged Google rows. Null for
 * Google-only rows or any record carrying a Google marker. Rebuilt field by
 * field so no Google-derived value can ride along.
 */
export function osmEnrichmentSnapshot(place: OsmPlace): OsmSnapshot | null {
  const candidate: unknown =
    place.source === "osm"
      ? place
      : (place as OsmPlace & { matchedOsm?: unknown }).matchedOsm;
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const osm = candidate as Partial<OsmPlace>;
  const idMatch = typeof osm.id === "string" ? OSM_ROW_ID.exec(osm.id) : null;
  if (
    !idMatch ||
    osm.source !== "osm" ||
    osm.osmType !== idMatch[1] ||
    osm.osmId !== Number(idMatch[2]) ||
    osm.googlePlaceId !== undefined ||
    osm.sources?.osm !== true ||
    osm.sources.google !== undefined ||
    typeof osm.name !== "string" ||
    typeof osm.isUnnamed !== "boolean" ||
    typeof osm.lat !== "number" ||
    typeof osm.lng !== "number" ||
    !Number.isFinite(osm.lat) ||
    !Number.isFinite(osm.lng)
  ) {
    return null;
  }
  const text = (value: unknown) =>
    typeof value === "string" ? value : undefined;
  const tags: Record<string, string> = {};
  if (osm.tags && typeof osm.tags === "object") {
    for (const [key, value] of Object.entries(osm.tags)) {
      if (typeof value === "string") {
        tags[key] = value;
      }
    }
  }
  return {
    id: osm.id!,
    source: "osm",
    osmType: osm.osmType!,
    osmId: osm.osmId!,
    name: osm.name,
    isUnnamed: osm.isUnnamed,
    // Search metadata computed by this app, not provider content.
    categoryId: osm.categoryId ?? place.categoryId,
    categoryLabel: text(osm.categoryLabel) ?? place.categoryLabel,
    lat: osm.lat,
    lng: osm.lng,
    distanceM:
      typeof osm.distanceM === "number" ? osm.distanceM : place.distanceM,
    address: text(osm.address),
    hours: text(osm.hours),
    website: text(osm.website),
    phone: text(osm.phone),
    tags,
    sources: { osm: true },
  };
}

type GoogleState =
  | { status: "idle" }
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
  const [requestNonce, setRequestNonce] = useState(0);
  const [google, setGoogle] = useState<GoogleState>({ status: "idle" });
  const [configuredHint, setConfiguredHint] = useState<string | null>(null);
  const [acceptedWeakMatch, setAcceptedWeakMatch] = useState(false);

  const requestGoogleDetails = useCallback(() => {
    setGoogle({ status: "loading" });
    setAcceptedWeakMatch(false);
    setRequestNonce((n) => n + 1);
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
        const res = await fetch("/api/places/google/status", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
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
    if (requestNonce === 0) return;
    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        // Direct Google results already carry their Place ID; no Text Search needed.
        if (place.source === "google" && place.googlePlaceId) {
          const res = await fetch(
            `/api/places/google/${encodeURIComponent(place.googlePlaceId)}`,
            { signal: controller.signal },
          );
          const data = (await res.json()) as GoogleLookupResponse;
          if (cancelled) return;
          if (data.status === "ok") {
            setGoogle({
              status: "ok",
              details: data.details,
              match: { confidence: "strong", distanceM: 0, nameSimilarity: 1,
                queriedName: place.name, googleName: data.details.name },
            });
            setAcceptedWeakMatch(true);
            return;
          }
          if (data.status === "unavailable" || data.status === "empty") {
            setGoogle(data);
            return;
          }
          setGoogle({ status: "error", message: data.message, retryable: data.retryable });
          return;
        }
        // Reuse session placeId (no Text Search) when an OSM row was already matched.
        const cachedPlaceId = readSessionGooglePlace(place.id);
        if (cachedPlaceId) {
          const res = await fetch(
            `/api/places/google/${encodeURIComponent(cachedPlaceId)}`,
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
              match: { confidence: "strong", distanceM: 0, nameSimilarity: 1,
                queriedName: place.name, googleName: data.details.name },
            });
            setAcceptedWeakMatch(true);
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
          writeSessionGooglePlace(place.id, data.details.placeId);
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
  }, [place.id, place.name, place.lat, place.lng, place.source, place.googlePlaceId, requestNonce]);

  const osmWebsiteHref = normalizeHttpUrl(place.website);
  const osmIdentity =
    place.source === "osm" &&
    typeof place.osmType === "string" &&
    typeof place.osmId === "number"
      ? { type: place.osmType, id: place.osmId }
      : null;
  const isGoogleRow = place.source === "google";
  // Foursquare / BestTime only ever receive this OSM-only record.
  const osmSnapshot = osmEnrichmentSnapshot(place);
  const matchedOsm = isGoogleRow ? osmSnapshot : null;
  const foursquareBlocked = foursquareBlocker(osmSnapshot);
  const bestTimeBlocked = bestTimeBlocker(osmSnapshot);
  const rowEmpty = isGoogleRow ? GOOGLE_EMPTY : undefined;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/30 sm:items-stretch sm:justify-end"
      role="presentation"
      onClick={onClose}
    >
      <aside
        className="flex max-h-[92vh] w-full max-w-md flex-col rounded-t-2xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl sm:h-full sm:max-h-none sm:rounded-none sm:rounded-l-none sm:border-l sm:border-y-0 sm:border-r-0"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="relative flex items-start gap-3 border-b border-[var(--line)] px-4 py-3 pt-5 sm:pt-3">
          <span
            className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-[var(--line)] sm:hidden"
            aria-hidden
          />
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--accent)] ring-1 ring-[var(--line)]">
            <CategoryIcon category={place.categoryId} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className={`truncate text-lg font-semibold text-[var(--ink)] ${place.isUnnamed ? "italic" : ""}`}
            >
              {place.name}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              {place.categoryLabel} · {formatDistance(place.distanceM)} ·{" "}
              {isGoogleRow ? (matchedOsm ? "Google + matched OSM" : "Google only") : place.source === "overture" ? "Overture" : "OSM"}
              {place.isUnnamed ? " · unnamed" : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="rounded-md px-2 py-1 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
          <section aria-labelledby="osm-section">
            <h3
              id="osm-section"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
              {place.source === "google" ? "Google" : place.source === "overture" ? "Overture Places" : "OpenStreetMap"}
            </h3>
            <dl className="mt-2 space-y-2 text-sm">
              <Row label="Address" value={place.address} empty={rowEmpty} />
              <Row label="Hours" value={place.hours} empty={rowEmpty} />
              <Row
                label="Website"
                value={place.website}
                href={osmWebsiteHref}
                empty={rowEmpty}
              />
              <Row label="Phone" value={place.phone} empty={rowEmpty} />
              <Row
                label="Coordinates"
                value={formatLatLng(place.lat, place.lng)}
              />
            </dl>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
              <span>
                {osmIdentity
                  ? "© OpenStreetMap contributors · ODbL"
                  : place.source === "overture" ? `Overture Maps Foundation · ${place.overture?.release ?? "unknown release"} · per-source license` : "Google Maps · display-only, never exported"}
              </span>
              {osmIdentity ? (
                <>
                  <a
                    href={osmBrowseUrl(osmIdentity.type, osmIdentity.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    View on openstreetmap.org
                  </a>
                  <CopyButton label="Copy name" value={place.name} />
                  <CopyButton
                    label="Copy coords"
                    value={formatLatLng(place.lat, place.lng, 6)}
                  />
                  <CopyButton
                    label="Copy OSM id"
                    value={`${osmIdentity.type}/${osmIdentity.id}`}
                  />
                </>
              ) : place.source === "overture" && place.overture ? (
                <span>GERS ID: {place.overture.id} · {place.overture.sources.map((source) => `${source.dataset} (${source.license ?? "license unspecified"})`).join(", ") || "source not listed"} · confidence {place.overture.confidence ?? "unknown"}</span>
              ) : (
                <>
                  {place.googlePlaceId ? <CopyButton label="Copy Google Place ID" value={place.googlePlaceId} /> : null}
                </>
              )}
            </p>
          </section>

          {matchedOsm ? (
            <section
              aria-labelledby="matched-osm-section"
              className="rounded-lg border border-[var(--line)] px-3 py-2"
            >
              <h3
                id="matched-osm-section"
                className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
              >
                Matched OpenStreetMap record
              </h3>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Original OSM data for this Google result — the only data
                Foursquare and BestTime receive.
              </p>
              <dl className="mt-2 space-y-2 text-sm">
                <Row label="OSM name" value={matchedOsm.name} />
                <Row label="OSM address" value={matchedOsm.address} />
                <Row
                  label="OSM coordinates"
                  value={formatLatLng(matchedOsm.lat, matchedOsm.lng)}
                />
              </dl>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                <span>© OpenStreetMap contributors · ODbL</span>
                <a
                  href={osmBrowseUrl(matchedOsm.osmType, matchedOsm.osmId)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  View on openstreetmap.org
                </a>
              </p>
            </section>
          ) : null}

          <section
            aria-labelledby="extras-section"
            className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/70 px-3 py-2"
          >
            <h3
              id="extras-section"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
              Busy hours &amp; more data
            </h3>
            <ul className="mt-1.5 space-y-1 text-xs text-[var(--muted)]">
              <li>
                <JumpButton target={BESTTIME_SECTION_ID}>
                  Busy hours (BestTime)
                </JumpButton>
                {" — "}
                {bestTimeBlocked
                  ? `unavailable: ${bestTimeBlocked.reason}`
                  : "on request · paid"}
              </li>
              <li>
                <JumpButton target={FOURSQUARE_SECTION_ID}>
                  Foursquare
                </JumpButton>
                {" — "}
                {foursquareBlocked
                  ? `unavailable: ${foursquareBlocked.reason}`
                  : "on request · Premium is a separate paid call"}
              </li>
            </ul>
            <p className="mt-1.5 text-[11px] text-[var(--muted)]">
              {!osmSnapshot
                ? "This result has no independent OSM record: Google and Overture data are never sent to Foursquare or BestTime. Search with OpenStreetMap or Both, then open an independently found OSM row. "
                : matchedOsm
                  ? "Uses the matched OSM record above — never this Google result’s details. "
                  : ""}
              Google’s official Places API has no busy hours.
            </p>
          </section>

          {place.source !== "overture" ? <section aria-labelledby="google-section">
            <h3
              id="google-section"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
            >
              Google Places
            </h3>

            {google.status === "idle" && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-[var(--muted)]">
                  Hours, ratings and up to five reviews load only when you request them.
                  Google Place Details is a paid API call; an OSM place may also need
                  a paid Google Text Search to find its Place ID.
                </p>
                <button
                  type="button"
                  className="rounded-md border border-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-[var(--surface-2)]"
                  onClick={requestGoogleDetails}
                >
                  Load Google details (paid request)
                </button>
              </div>
            )}

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
                    onClick={requestGoogleDetails}
                  >
                    Retry Google details (paid request)
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
          </section> : null}

          <FoursquarePanel place={osmSnapshot} matched={Boolean(matchedOsm)} />
          <BestTimePanel place={osmSnapshot} matched={Boolean(matchedOsm)} />

          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            Overture rows are exported only in their own lane. Google content is display-only with required attribution and is
            never included in exports or sent to Foursquare or BestTime.
            Official Places API only — no scraping. Press Esc to close.
          </p>
        </div>
      </aside>
    </div>
  );
}

function AiSummaryBlock({
  title,
  summary,
}: {
  title: string;
  summary: GoogleAiSummary;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/80 px-3 py-2">
      <p className="text-sm font-medium text-[var(--ink)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--ink)]">{summary.text}</p>
      <p className="mt-2 text-[11px] text-[var(--muted)]" translate="no">
        {summary.disclosureText ? `${summary.disclosureText} · ` : ""}
        Generated by Google · shown verbatim · not written by this app
      </p>
    </div>
  );
}

const GOOGLE_EMPTY = "Not provided by Google";

/** Scrolls to and focuses a drawer section (no URL hash change). */
function JumpButton({
  target,
  children,
}: {
  target: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
      onClick={() => {
        const section = document.getElementById(target);
        section?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        section?.focus({ preventScroll: true });
      }}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  value,
  link,
  href,
  empty = "Not tagged in OSM",
}: {
  label: string;
  value?: string;
  link?: boolean;
  /** Prefer over `value` when linking (normalized URL). */
  href?: string;
  /** Shown when `value` is missing; names the source that lacks it. */
  empty?: string;
}) {
  const linkHref = href ?? (link ? normalizeHttpUrl(value) : undefined);
  return (
    <div>
      <dt className="inline font-medium text-[var(--ink)]">{label}: </dt>
      <dd className="inline break-words text-[var(--muted)]">
        {value ? (
          linkHref ? (
            <a
              href={linkHref}
              target="_blank"
              rel="noreferrer"
              className="break-all text-[var(--accent)] underline-offset-2 hover:underline"
            >
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          empty
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
        From Places API (New) only — Place IDs can be saved or copied; other
        Google data stays display-only. No SerpAPI or scrapers.
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
  const attributes = details.attributes;
  const hoursLines =
    attributes?.currentHoursWeekday?.length
      ? attributes.currentHoursWeekday
      : details.hoursWeekday;
  const statusNotice =
    attributes?.businessStatus === "CLOSED_PERMANENTLY"
      ? "Permanently closed"
      : attributes?.businessStatus === "CLOSED_TEMPORARILY"
        ? "Temporarily closed"
        : null;

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
              before loading Google details and reviews.
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
          Confirm the match above to show Google hours and reviews.
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
            <Row label="Address" value={details.address} empty={GOOGLE_EMPTY} />
            <Row label="Phone" value={details.phone} empty={GOOGLE_EMPTY} />
            <Row
              label="Website"
              value={details.website}
              link
              empty={GOOGLE_EMPTY}
            />
            {attributes?.priceLevelLabel ? (
              <Row label="Price level" value={attributes.priceLevelLabel} />
            ) : null}
            {attributes?.priceRangeLabel ? (
              <Row label="Typical spend" value={attributes.priceRangeLabel} />
            ) : null}
          </dl>

          {statusNotice ? (
            <p
              className="rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 text-xs font-medium text-[var(--danger)]"
              role="status"
            >
              {statusNotice} according to Google
            </p>
          ) : null}

          {attributes?.editorialSummary ? (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/80 px-3 py-2">
              <p className="text-sm font-medium text-[var(--ink)]">
                About this place
              </p>
              <p className="mt-1 text-sm text-[var(--ink)]">
                {attributes.editorialSummary}
              </p>
              <p className="mt-2 text-[11px] text-[var(--muted)]" translate="no">
                Google editorial summary · shown verbatim
              </p>
            </div>
          ) : null}

          {attributes?.generativeSummary ? (
            <AiSummaryBlock
              title="AI overview"
              summary={attributes.generativeSummary}
            />
          ) : null}

          {attributes?.neighborhoodSummary ? (
            <AiSummaryBlock
              title="Neighborhood"
              summary={attributes.neighborhoodSummary}
            />
          ) : null}

          {attributes?.evCharging ? (
            <div className="rounded-lg border border-[var(--line)] bg-[var(--surface-2)]/80 px-3 py-2">
              <p className="text-sm font-medium text-[var(--ink)]">
                EV charging
                {typeof attributes.evCharging.connectorCount === "number" ? (
                  <span className="ml-1 font-normal text-[var(--muted)]">
                    ({attributes.evCharging.connectorCount} connectors)
                  </span>
                ) : null}
              </p>
              {attributes.evCharging.connectors.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
                  {attributes.evCharging.connectors.map((connector) => (
                    <li key={`${connector.type}-${connector.maxKw ?? "na"}`}>
                      {connector.type}
                      {connector.count ? ` × ${connector.count}` : ""}
                      {typeof connector.maxKw === "number"
                        ? ` · ${connector.maxKw} kW`
                        : ""}
                      {typeof connector.available === "number"
                        ? ` · ${connector.available} available`
                        : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
              {attributes.evChargeAmenitySummary ? (
                <p className="mt-1.5 text-xs text-[var(--muted)]">
                  {attributes.evChargeAmenitySummary.text}
                </p>
              ) : null}
            </div>
          ) : null}

          {attributes?.fuelPrices && attributes.fuelPrices.length > 0 ? (
            <div>
              <p className="text-sm font-medium text-[var(--ink)]">
                Fuel prices
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
                {attributes.fuelPrices.map((entry) => (
                  <li key={entry.label}>
                    {entry.label}: {entry.price}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Prices as reported by Google — may be outdated.
              </p>
            </div>
          ) : null}

          {attributes &&
          [
            attributes.serves,
            attributes.amenities,
            attributes.accessibility,
            attributes.payment,
            attributes.parking,
          ].some((group) => group && group.length > 0) ? (
            <div>
              <p className="text-sm font-medium text-[var(--ink)]">
                Features
              </p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {(
                  [
                    attributes.serves,
                    attributes.amenities,
                    attributes.accessibility,
                    attributes.payment,
                    attributes.parking,
                  ] as Array<string[] | undefined>
                )
                  .flatMap((group) => group ?? [])
                  .map((label) => (
                    <li
                      key={label}
                      className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
                    >
                      {label}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          {hoursLines && hoursLines.length > 0 ? (
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-sm font-medium text-[var(--ink)]">Hours</p>
                {typeof attributes?.openNow === "boolean" ? (
                  <span
                    className={
                      attributes.openNow
                        ? "rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]"
                        : "rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] text-[var(--muted)]"
                    }
                  >
                    {attributes.openNow ? "Open now" : "Closed now"}
                  </span>
                ) : null}
              </div>
              <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">
                {hoursLines.map((line) => (
                  <li key={line}>{line}</li>
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
