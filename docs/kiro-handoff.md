# Places Discovery — Kiro / next-agent handoff

**Repo:** https://github.com/Pulakhitman/places-discovery (public)  
**Local:** repository root (often `~/Desktop/places-discovery`)  
**Production:** https://places.dhakafareast.tech (Traefik + Docker on Hostinger VPS)  
**Deploy path on VPS:** `/opt/places-discovery`

## What this app is

Self-hostable **Places Discovery**: one Leaflet map, OSM Overpass search, optional official Google Places (New) for hours/ratings/reviews (≤5). **No scrapers / Outscraper / SerpAPI.** Dual-lane exports (OSM only — never Google). Shared **`ACCESS_KEY`** unlock gate (httpOnly cookie).

## Production deploy (Hostinger)

- Domain: `places.dhakafareast.tech`
- Clone on VPS (not yaml-only paste — Compose uses `build: .`)
- `.env` on VPS: `DOMAIN`, `TRAEFIK_*`, `ACCESS_KEY`, `GOOGLE_MAPS_API_KEY`, optional browser key
- Joins existing Traefik network; do not replace Traefik
- Rebuild after pulls:

```bash
cd /opt/places-discovery && git pull && docker compose build --no-cache && docker compose up -d
```

Checklist / access gate notes: see [README.md](../README.md) (Docker / VPS redeploy sections) and [`STEP5_SUMMARY.md`](../STEP5_SUMMARY.md).

## Hard lessons (do not regress)

1. **`npm ci` / Docker:** keep `package-lock.json` in sync with `package.json`.
2. **Unlock redirect loop:** never prerender `/unlock` as if `ACCESS_KEY` is empty at build time. Use runtime/`connection()` + `instant = false` / Suspense. Build must succeed with Cache Components.
3. **Google “off” banner:** do not trust build-time cached status APIs; use live `/api/health` (`googlePlacesConfigured`).
4. **Sidebar UI:** single scroll on left column; no nested scrollports; hierarchy inputs must defeat Chrome address autofill; country dropdown high z-index / fixed.
5. GitHub clone: no passwords — public HTTPS or PAT/SSH.

## Recent main tip (as of handoff)

Lockfile sync, unlock loop/build fixes, results list + Google banner, sidebar scroll, single-scroll + autofill — all on `main`. Confirm with `git log -5 --oneline` before assuming tip.

## Local preferences

- Dev often on **port 3001** (`npm run dev -- -p 3001`)
- Hierarchy: searchable dropdown lists; county scopes cities; area + radius search
- Cursor Project preferences when present (do not commit secrets)

## Queued / optional next

- Yelp column is optional / not in-repo yet — refuse scraping if explored
- Reviews official plan: [reviews-official-api-plan.md](./reviews-official-api-plan.md) (official Places API only)

## Constraints for any agent (Cursor or Kiro)

- Official Google Places API only for Google data
- Refuse scraping / unofficial Maps proxies
- Do not commit `.env` / `.env.local`
- Prefer Traefik reuse; expose `3000` only inside Docker network
