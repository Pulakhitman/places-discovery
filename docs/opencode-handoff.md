# Places Discovery — OpenCode handoff

**Repo:** https://github.com/Pulakhitman/places-discovery (public)  
**Local:** repository root (often `~/Desktop/places-discovery`)  
**Production:** https://places.dhakafareast.tech  
**VPS path:** `/opt/places-discovery`

Same product context as the Kiro handoff — see also [AGENTS.md](../AGENTS.md) and [kiro-handoff.md](./kiro-handoff.md).

## What this app is

Self-hostable Places Discovery: one Leaflet map, OSM Overpass, optional official Google Places (New) for hours/ratings/reviews (≤5). **No scrapers.** OSM-only exports. Shared **`ACCESS_KEY`** unlock (httpOnly cookie).

## OpenCode kickoff

1. Open/clone the repo on `main`.
2. Instruct OpenCode: **read [AGENTS.md](../AGENTS.md) first**, then this file / [kiro-handoff.md](./kiro-handoff.md) / [README.md](../README.md).
3. Local: `npm install && npm run dev -- -p 3001` (secrets in `.env.local` only).
4. After merges to prod:

```bash
cd /opt/places-discovery && git pull && docker compose build --no-cache && docker compose up -d
```

Suggested first message:

> Read AGENTS.md and docs/opencode-handoff.md. Continue Places Discovery — official Google Places only, no scrapers. Prod: places.dhakafareast.tech at /opt/places-discovery.

## Hard lessons (do not regress)

1. Keep `package-lock.json` synced (`npm ci` in Docker).
2. `/unlock` must not prerender with empty ACCESS_KEY (redirect loop); use runtime + Cache Components–safe exports.
3. Google “off” banner: live `/api/health`, not build-time cached status.
4. Left sidebar: **one** scroll; defeat Chrome address autofill on hierarchy filters; high z-index dropdowns.
5. Hostinger: clone repo then Compose (`build: .`); yaml-only paste is not enough. Reuse existing Traefik.

## Optional next

- Yelp column: optional / not in-repo yet — refuse scraping if explored
- Reviews: [reviews-official-api-plan.md](./reviews-official-api-plan.md) (official API path only)

## Constraints

Official Google Places only · refuse scraping · never commit `.env*` · Traefik expose-only on 3000.
