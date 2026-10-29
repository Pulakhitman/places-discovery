"use client";

import { useEffect, useId, useState } from "react";
import type { OsmPlace } from "@/lib/places/types";
import type { BestTimeForecast, BestTimeIdentity, BestTimeLive, BestTimeResponse } from "@/lib/places/besttime-types";
import { BESTTIME_PRIVATE_KEY_ENV, BESTTIME_PUBLIC_KEY_ENV, forecastHour, preciseOsmAddress, validateBestTimeInput, type BestTimeKeyState, type BestTimeKeyStatus } from "@/lib/providers/besttime";

export const BESTTIME_SECTION_ID = "besttime-section";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const KEY_STATES: readonly unknown[] = ["ok", "missing", "wrong_type", "invalid"];
/** The only tags the server's precise-address check reads; no other OSM tag leaves the browser. */
const ADDRESS_TAGS = ["addr:full", "contact:full", "addr:street", "contact:street", "addr:road", "addr:place", "addr:housenumber", "contact:housenumber", "addr:housename"];

type State<T> = { status: "idle" | "loading" | "error"; message?: string; result?: T; accepted?: boolean };
/** "unknown" keeps the buttons usable: the server still refuses unconfigured calls without contacting BestTime. */
type Setup = { status: "checking" | "ready" | "unknown" } | { status: "blocked"; keys: BestTimeKeyStatus | null };
export type BestTimeBlocked = { reason: string; help: string };

const GOOGLE_ONLY: BestTimeBlocked = {
  reason: "Google-only result",
  help: "BestTime only receives OpenStreetMap data, and this result has no matched OSM record. Google data is never sent to BestTime. Search with OpenStreetMap or Both (merged), then open this place’s OSM row to request busy hours.",
};

const PRIVATE_KEY_PROBLEM: Record<Exclude<BestTimeKeyState, "ok">, string> = {
  missing: `${BESTTIME_PRIVATE_KEY_ENV} is not set.`,
  wrong_type: `${BESTTIME_PRIVATE_KEY_ENV} holds a public key (pub_…), which cannot create forecasts or check live busyness.`,
  invalid: `${BESTTIME_PRIVATE_KEY_ENV} is not a valid BestTime private key (expected pri_…).`,
};
const PUBLIC_KEY_PROBLEM: Partial<Record<BestTimeKeyState, string>> = {
  wrong_type: `${BESTTIME_PUBLIC_KEY_ENV} holds a private key (pri_…). Move it to ${BESTTIME_PRIVATE_KEY_ENV}.`,
  invalid: `${BESTTIME_PUBLIC_KEY_ENV} is not a valid BestTime public key (expected pub_…).`,
};

/** Request fields, copied from the OSM record only. The server re-validates the same shape. */
export function bestTimeRequestBody(place: OsmPlace) {
  const tags: Record<string, string> = {};
  for (const key of ADDRESS_TAGS) if (typeof place.tags?.[key] === "string") tags[key] = place.tags[key];
  return { id: place.id, source: place.source, sources: place.sources, googlePlaceId: place.googlePlaceId, isUnnamed: place.isUnnamed,
    name: place.name, address: place.address, tags, lat: place.lat, lng: place.lng };
}

function addressGap(place: OsmPlace): string {
  const has = (...keys: string[]) => keys.some((key) => Boolean(place.tags?.[key]?.trim()));
  if (!place.address?.trim()) return "No address in OpenStreetMap";
  if (has("addr:full", "contact:full")) return "OSM address can’t be used";
  const street = has("addr:street", "contact:street", "addr:road", "addr:place");
  const house = has("addr:housenumber", "contact:housenumber", "addr:housename");
  if (!street && !house) return "OSM address has no street or house number";
  return street ? "OSM address has no house number" : "OSM address has no street";
}

/** Why BestTime cannot be requested for this record, or null when the paid actions may be offered. */
export function bestTimeBlocker(place: OsmPlace | null): BestTimeBlocked | null {
  if (!place || place.source !== "osm" || place.sources?.google || place.googlePlaceId !== undefined) return GOOGLE_ONLY;
  if (place.isUnnamed) return { reason: "Unnamed in OpenStreetMap", help: "BestTime identifies a venue by name and street address, and this place has no name tag. Pick a named place, or add its name on openstreetmap.org." };
  if (!preciseOsmAddress(place.tags, place.address)) return { reason: addressGap(place), help: "BestTime needs a street-level address (addr:street + addr:housenumber, or addr:full) so it cannot attribute another venue’s traffic to this place. Add the address on openstreetmap.org to enable busy hours." };
  if (!validateBestTimeInput(bestTimeRequestBody(place))) return { reason: "OSM record can’t be used", help: "BestTime needs an OSM id, a name of at most 120 characters and valid coordinates." };
  return null;
}

function readSetup(data: unknown): Setup {
  const keys = (data as { bestTimeKeyStatus?: Partial<BestTimeKeyStatus> } | null)?.bestTimeKeyStatus;
  if (!keys || !KEY_STATES.includes(keys.privateKey) || !KEY_STATES.includes(keys.publicKey)) return { status: "unknown" };
  return keys.privateKey === "ok" ? { status: "ready" } : { status: "blocked", keys: keys as BestTimeKeyStatus };
}

function SetupNotice({ id, keys }: { id: string; keys: BestTimeKeyStatus | null }) {
  const readOnly = keys?.publicKey === "ok";
  const publicProblem = keys ? PUBLIC_KEY_PROBLEM[keys.publicKey] : undefined;
  return <div id={id} role="status" className="space-y-1 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
    <p className="font-medium text-[var(--ink)]">{readOnly ? "Read-only BestTime key only" : "BestTime is not set up"}</p>
    {keys && keys.privateKey !== "ok" && <p>{PRIVATE_KEY_PROBLEM[keys.privateKey]}</p>}
    {readOnly && <p>A public key can only read forecasts already created with the same key set, by BestTime venue ID. This app keeps no venue IDs, so it sends no public-key requests.</p>}
    {publicProblem && <p>{publicProblem}</p>}
    <p>To create forecasts or check live busyness, add <code>{BESTTIME_PRIVATE_KEY_ENV}=pri_…</code> (your BestTime private key) to the server environment, then restart the app.</p>
  </div>;
}

function Identity({ identity, accepted, onAccept }: { identity: BestTimeIdentity; accepted: boolean; onAccept: () => void }) {
  return <div className="space-y-1 text-xs">
    <p className="font-medium">BestTime found: {identity.name}</p>
    <p>{identity.address} · {identity.distanceM} m from OSM pin · {Math.round(identity.nameSimilarity * 100)}% name similarity</p>
    {identity.confidence === "weak" && !accepted && <>
      <p className="text-[var(--danger)]">This may be another venue. Review its name and address before attributing this data to the OSM place.</p>
      <button type="button" className="btn-primary text-xs" onClick={onAccept}>Accept this BestTime venue</button>
    </>}
  </div>;
}

function Week({ forecast }: { forecast: BestTimeForecast }) {
  return <div className="space-y-3">
    <p className="text-xs text-[var(--muted)]">Typical weekly forecast, relative to this venue’s busiest forecasted hour (100%). Not live or absolute visitor counts. Each day runs 06:00–05:00 the next day.</p>
    {forecast.days.map(({ day, hours }) => <div key={day}>
      <p className="text-xs font-semibold">{WEEKDAYS[day]}</p>
      <div className="grid grid-cols-24 gap-px" role="img" aria-label={`${WEEKDAYS[day]} forecast: ${hours.map((value, index) => `${forecastHour(index)} ${value}%`).join(", ")}`}>
        {hours.map((value, index) => <div key={index} title={`${forecastHour(index)} · ${value}% of venue peak`} className="flex h-12 items-end bg-[var(--line)]">
          <div className="w-full bg-[var(--accent)]" style={{ height: `${value}%` }} />
        </div>)}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--muted)]"><span>06:00</span><span>12:00</span><span>18:00</span><span>00:00 +1</span><span>05:00 +1</span></div>
    </div>)}
  </div>;
}

/**
 * `place` must be an OSM record: the row itself, or the original OSM snapshot matched to a
 * merged Google row (`matched`). Anything else gets an explanation and no request at all.
 */
export function BestTimePanel({ place, matched = false }: { place: OsmPlace | null; matched?: boolean }) {
  const blocked = bestTimeBlocker(place);
  return <section id={BESTTIME_SECTION_ID} tabIndex={-1} aria-label="Busy hours: BestTime foot traffic" className="space-y-3 border-t border-[var(--line)] pt-4 text-sm outline-none">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Busy hours · BestTime foot traffic</h3>
    <p className="text-xs text-[var(--muted)]">Google’s official Places API has no busy-hours data, so busy hours come only from the official BestTime API · each request is on demand and may incur a charge · display only, not exported.</p>
    {blocked || !place
      ? <div role="status" className="space-y-1 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
          <p className="font-medium text-[var(--ink)]">Busy hours unavailable: {(blocked ?? GOOGLE_ONLY).reason}</p>
          <p>{(blocked ?? GOOGLE_ONLY).help}</p>
        </div>
      : <BestTimeActions key={place.id} place={place} matched={matched} />}
  </section>;
}

function BestTimeActions({ place, matched }: { place: OsmPlace; matched: boolean }) {
  const noticeId = useId();
  const [setup, setSetup] = useState<Setup>({ status: "checking" });
  const [forecast, setForecast] = useState<State<BestTimeForecast>>({ status: "idle" });
  const [live, setLive] = useState<State<BestTimeLive>>({ status: "idle" });

  useEffect(() => {
    // Free local status check only; it never contacts BestTime or starts a paid request.
    const controller = new AbortController();
    fetch("/api/health", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => { if (!controller.signal.aborted) setSetup(readSetup(data)); })
      .catch(() => { if (!controller.signal.aborted) setSetup({ status: "unknown" }); });
    return () => controller.abort();
  }, []);

  async function load(action: "forecast" | "live") {
    const update = action === "forecast" ? setForecast : setLive;
    update({ status: "loading" });
    try {
      const response = await fetch("/api/places/besttime", { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...bestTimeRequestBody(place) }) });
      const data = await response.json() as BestTimeResponse;
      if (data.status === "unavailable") { update({ status: "idle" }); setSetup({ status: "blocked", keys: null }); return; }
      if (data.status !== "ok" || data.result.kind !== action) { update({ status: "error", message: data.status === "ok" ? "Unexpected BestTime response." : data.message }); return; }
      if (action === "forecast") setForecast({ status: "idle", result: data.result as BestTimeForecast });
      else setLive({ status: "idle", result: data.result as BestTimeLive });
    } catch { update({ status: "error", message: "Could not reach BestTime." }); }
  }
  const showForecast = forecast.result && (forecast.result.identity.confidence === "strong" || forecast.accepted);
  const showLive = live.result && (live.result.identity.confidence === "strong" || live.accepted);
  const describedBy = setup.status === "blocked" ? noticeId : undefined;
  const unavailable = setup.status === "blocked" || setup.status === "checking";
  return <>
    <p className="text-xs text-[var(--muted)]">{matched
      ? <>Uses the matched OpenStreetMap record <span className="font-medium text-[var(--ink)]">{place.name}</span> ({place.address}) — never this Google result’s name, address or coordinates.</>
      : <>Sends only this OpenStreetMap record’s name and street address.</>}</p>
    {setup.status === "checking" && <p role="status" className="text-xs text-[var(--muted)]">Checking BestTime setup…</p>}
    {setup.status === "blocked" && <SetupNotice id={noticeId} keys={setup.keys} />}
    <button type="button" className="btn-primary text-xs" disabled={unavailable || forecast.status === "loading"} aria-describedby={describedBy} onClick={() => void load("forecast")}>Create weekly forecast (paid request)</button>
    {forecast.status === "loading" && <p role="status">Loading forecast…</p>}
    {forecast.status === "error" && <p role="alert">{forecast.message}</p>}
    {forecast.result && <Identity identity={forecast.result.identity} accepted={Boolean(forecast.accepted)} onAccept={() => setForecast((current) => ({ ...current, accepted: true }))} />}
    {showForecast && <Week forecast={forecast.result!} />}
    <div className="border-t border-[var(--line)] pt-3">
      <button type="button" className="btn-primary text-xs" disabled={unavailable || live.status === "loading"} aria-describedby={describedBy} onClick={() => void load("live")}>Check live busyness (separate paid request)</button>
      {live.status === "loading" && <p role="status">Checking live busyness…</p>}
      {live.status === "error" && <p role="alert">{live.message}</p>}
      {live.result && <Identity identity={live.result.identity} accepted={Boolean(live.accepted)} onAccept={() => setLive((current) => ({ ...current, accepted: true }))} />}
      {showLive && <p className="text-xs">{live.result!.available ? `Current live busyness: ${live.result!.busyness}% of typical venue peak${live.result!.forecastBusyness !== undefined ? ` · forecast for this hour: ${live.result!.forecastBusyness}%` : ""}.` : "Live data is unavailable right now. No live value is shown."}</p>}
      <p className="text-xs text-[var(--muted)]">Live may exceed 100%; it is separate from the typical weekly forecast.</p>
    </div>
  </>;
}
