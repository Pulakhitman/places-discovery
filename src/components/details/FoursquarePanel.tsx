"use client";

import { useState } from "react";
import type { FoursquareMatch, FoursquarePlace, FoursquareResponse, FoursquareTimeWindow } from "@/lib/places/foursquare-types";
import type { OsmPlace } from "@/lib/places/types";
import { validateFoursquareInput } from "@/lib/providers/foursquare";

export const FOURSQUARE_SECTION_ID = "foursquare-section";

const days = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type State = { kind: "idle" | "loading" | "empty" | "error"; message?: string } | { kind: "found"; match: FoursquareMatch; tier: "pro" | "premium" };
export type FoursquareBlocked = { reason: string; help: string };

const GOOGLE_ONLY: FoursquareBlocked = {
  reason: "Google-only result",
  help: "Foursquare only receives OpenStreetMap data, and this result has no matched OSM record. Google data is never sent to Foursquare. Search with OpenStreetMap or Both (merged), then open this place’s OSM row to look it up.",
};

/** Why Foursquare cannot be searched for this record, or null when the actions may be offered. */
export function foursquareBlocker(place: OsmPlace | null): FoursquareBlocked | null {
  // Google-derived rows must not be transmitted at all, not even their name or coordinates.
  if (!place || place.source !== "osm" || place.sources?.google || place.googlePlaceId !== undefined || !/^osm:(node|way|relation)\/\d+$/.test(place.id)) return GOOGLE_ONLY;
  if (place.isUnnamed) return { reason: "Unnamed in OpenStreetMap", help: "Foursquare is searched by name near the OSM pin, and this place has no name tag. Pick a named place, or add its name on openstreetmap.org." };
  if (!validateFoursquareInput({ name: place.name, lat: place.lat, lng: place.lng })) return { reason: "OSM name or coordinates can’t be used", help: "Foursquare search needs a name of 2–120 characters and valid coordinates." };
  return null;
}

function Windows({ windows }: { windows: FoursquareTimeWindow[] }) {
  return <ul className="mt-1 space-y-0.5 text-xs text-[var(--muted)]">{windows.map((w, i) => <li key={`${w.day}-${w.open}-${i}`}>{days[w.day]} {w.open}–{w.close}</li>)}</ul>;
}
function Link({ href, children }: { href?: string; children: React.ReactNode }) {
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--accent)] underline-offset-2 hover:underline">{children}</a> : null;
}
function Field({ label, value }: { label: string; value?: string | number }) {
  return value !== undefined && value !== "" ? <div><dt className="inline font-medium text-[var(--ink)]">{label}: </dt><dd className="inline break-words text-[var(--muted)]">{value}</dd></div> : null;
}

/**
 * `place` must be an OSM record: the row itself, or the original OSM snapshot matched to a
 * merged Google row (`matched`). Anything else gets an explanation and no request at all.
 */
export function FoursquarePanel({ place, matched = false }: { place: OsmPlace | null; matched?: boolean }) {
  const blocked = foursquareBlocker(place);
  return <section id={FOURSQUARE_SECTION_ID} tabIndex={-1} aria-label="Foursquare Places" className="space-y-2 border-t border-[var(--line)] pt-4 text-sm outline-none">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Foursquare Places</h3>
    <p className="text-xs text-[var(--muted)]">Official Places API · on demand · display only, never exported. No photos or caching. Pro search finds the match; Premium (rating, hours, popular time windows, tips) is a separate paid call and is never loaded automatically.</p>
    {blocked || !place
      ? <div role="status" className="space-y-1 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
          <p className="font-medium text-[var(--ink)]">Foursquare unavailable: {(blocked ?? GOOGLE_ONLY).reason}</p>
          <p>{(blocked ?? GOOGLE_ONLY).help}</p>
        </div>
      : <FoursquareActions key={place.id} place={place} matched={matched} />}
  </section>;
}

function FoursquareActions({ place, matched }: { place: OsmPlace; matched: boolean }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [confirmed, setConfirmed] = useState(false);
  async function request(action: "search" | "premium", match?: FoursquareMatch) {
    setState({ kind: "loading", message: action === "premium" ? "Loading paid Premium details…" : "Searching Foursquare…" });
    try {
      const response = await fetch("/api/places/foursquare", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        // Name and coordinates come from the OSM record only.
        body: JSON.stringify({ action, name: place.name, lat: place.lat, lng: place.lng, ...(match ? { id: match.place.id, confirmWeak: confirmed } : {}) }),
      });
      const body = await response.json() as FoursquareResponse;
      if (body.status === "ok") setState({ kind: "found", match: body.match, tier: body.tier });
      else { setConfirmed(false); setState({ kind: body.status === "empty" ? "empty" : "error", message: body.message }); }
    } catch { setState({ kind: "error", message: "Could not reach Foursquare." }); }
  }
  const match = state.kind === "found" ? state.match : null;
  const data: FoursquarePlace | null = match?.place ?? null;
  const show = match && (match.confidence === "strong" || confirmed);
  return <>
    <p className="text-xs text-[var(--muted)]">{matched
      ? <>Uses the matched OpenStreetMap record <span className="font-medium text-[var(--ink)]">{place.name}</span> — never this Google result’s name or coordinates.</>
      : <>Sends only this OpenStreetMap record’s name and coordinates.</>}</p>
    {(state.kind === "idle" || state.kind === "error" || state.kind === "empty") && <button className="btn-primary text-xs" type="button" onClick={() => { setConfirmed(false); void request("search"); }}>Find Foursquare match (Pro)</button>}
    {(state.kind === "error" || state.kind === "empty") && <p role="status" className="text-xs text-[var(--muted)]">{state.message}</p>}
    {state.kind === "loading" && <p role="status" className="text-xs text-[var(--muted)]">{state.message}</p>}
    {data && match && <>
      <p className="text-sm font-medium text-[var(--ink)]">{data.name}</p>
      <p className="text-xs text-[var(--muted)]">{match.distanceM} m from OSM pin · {Math.round(match.nameSimilarity * 100)}% name similarity · {match.confidence} match</p>
      {match.confidence === "weak" && !confirmed && <><p className="text-xs text-[var(--danger)]">This may not be the same place. Confirm before viewing details.</p><button type="button" className="btn-primary text-xs" onClick={() => setConfirmed(true)}>Use this Foursquare match</button></>}
      {show && <>
        <dl className="space-y-1 text-xs">
          <Field label="Categories" value={data.categories.join(", ")} />
          <Field label="Address" value={data.address} />
          <Field label="Chains" value={data.chains.join(", ")} />
          <Field label="Phone" value={data.phone} />
          <Field label="Email" value={data.email} />
          {data.website && <div><dt className="inline font-medium">Website: </dt><dd className="inline"><Link href={data.website}>{data.website}</Link></dd></div>}
          {data.social?.instagram && <Field label="Instagram" value={data.social.instagram} />}
          {data.social?.facebook && <Field label="Facebook" value={data.social.facebook} />}
          {data.social?.twitter && <Field label="Twitter" value={data.social.twitter} />}
          {state.kind === "found" && state.tier === "premium" && <>
            <Field label="Rating (0–10)" value={data.rating} /><Field label="Price (1–4)" value={data.price} />
            <Field label="Description" value={data.description} />
            <Field label="Hours" value={data.hours?.display} />
            {data.hours?.openNow !== undefined && <Field label="Open now" value={data.hours.openNow ? "Yes" : "No"} />}
            {Boolean(data.hours?.regular.length) && <div><dt className="font-medium">Regular hours</dt><dd><Windows windows={data.hours!.regular} /></dd></div>}
            {Boolean(data.popularWindows?.length) && <div><dt className="font-medium">Popular time windows (not hourly traffic)</dt><dd><Windows windows={data.popularWindows!} /></dd></div>}
            {data.popularity !== undefined && <Field label="Popularity" value={`${data.popularity} / 1 (relative foot traffic in this area, six-month span)`} />}
            <Field label="Tags" value={data.tags?.join(", ")} />
            <Field label="Ratings count" value={data.stats?.ratings} /><Field label="Tips count" value={data.stats?.tips} /><Field label="Photos count (no photos returned)" value={data.stats?.photos} />
            <Field label="Tastes" value={data.tastes?.join(", ")} />
            <Field label="Veracity (data quality, 1–5)" value={data.veracity} />
            {data.tips?.map((tip, i) => <Field key={i} label={`Tip ${i + 1}`} value={tip} />)}
            {data.menu && <div>Menu: <Link href={data.menu}>{data.menu}</Link></div>}
            {data.actions?.map((action, i) => <div key={i}><Link href={action.url}>{action.label}</Link></div>)}
          </>}
        </dl>
        {state.kind === "found" && state.tier === "pro" && <button className="btn-primary text-xs" type="button" onClick={() => void request("premium", match)}>Load Premium details (paid API call)</button>}
        <p className="text-xs text-[var(--muted)]" translate="no">© Foursquare · <Link href={data.link}>View place on Foursquare</Link> · not exported</p>
      </>}
    </>}
  </>;
}
