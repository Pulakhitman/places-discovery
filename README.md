# Places Discovery

Self-hostable places intelligence workspace: pick an area on **one map**, then discover nearby places via OpenStreetMap (and official Google Places APIs in later steps).

**Hard rule:** no Google Maps HTML scraping or third-party scrapers.

## Local run

```bash
npm install
cp .env.example .env   # optional — Nominatim / Overpass defaults work out of the box
npm run dev -- -p 3001
```

Open [http://localhost:3001](http://localhost:3001) (use `-p 3001` when port 3000 is already in use).

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build & serve |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |

Health check: [http://localhost:3001/api/health](http://localhost:3001/api/health)

## Environment variables

See [`.env.example`](./.env.example). Important keys:

| Variable | Purpose |
| --- | --- |
| `NOMINATIM_URL` | Geocoding base URL (default public Nominatim) |
| `OVERPASS_URL` | OSM Overpass interpreter (default public instance) |
| `OVERPASS_TIMEOUT_MS` | Overpass client timeout (default 25000) |
| `GOOGLE_MAPS_API_KEY` | Server Places API (New) — details drawer enrichment |
| `GOOGLE_PLACES_TIMEOUT_MS` | Google Places client timeout (default 15000) |
| `GOOGLE_MAPS_BROWSER_KEY` | Optional Maps JS in the same map container |
| `DOMAIN`, `TRAEFIK_*` | Traefik / Docker labels |
| `ACCESS_KEY` | Optional shared unlock key (httpOnly cookie gate) |

Respect Nominatim and Overpass usage policies on public instances.

## Docker

**Local (no Traefik), port 3001:**

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

**Behind Traefik:**

```bash
cp .env.example .env
docker network create traefik   # once
# set DOMAIN / TRAEFIK_* in .env
docker compose up --build -d
```

Compose uses `expose: ["3000"]` for Traefik (no host ports unless you use the local override). Health: `GET /api/health`.

Optional access gate: set `ACCESS_KEY` (unlock page + httpOnly cookie; health stays public).

### VPS redeploy (behind Traefik)

```bash
cd /path/to/places-discovery
git pull
docker compose build
docker compose up -d
```

Confirm `.env` has `ACCESS_KEY`, `DOMAIN=places.dhakafareast.tech`, and matching `TRAEFIK_*`. Health should stay public: `curl -fsS https://$DOMAIN/api/health`.

### Traefik / network checks

- Container is on the external Traefik network: `docker network inspect traefik | grep places-discovery`
- Router Host rule matches the public hostname (`DOMAIN`)
- Entrypoint is TLS (`websecure` / `TRAEFIK_ENTRYPOINT`) and cert resolver is set
- Traefik forwards `X-Forwarded-Proto=https` (default when TLS terminates at Traefik)
- No app-level force-HTTPS redirect needed; Traefik already redirects HTTP→HTTPS
- If you see `/` ↔ `/unlock` loops after enabling `ACCESS_KEY`, rebuild so `/unlock` is not served from a build-time prerender that redirected home when `ACCESS_KEY` was empty

## Status

- **Step 1** — Scaffold, location hierarchy (full dropdowns), single Leaflet map. See [`STEP1_SUMMARY.md`](./STEP1_SUMMARY.md).
- **Step 2** — Overpass nearby search, results list, markers + card sync, coverage. See [`STEP2_SUMMARY.md`](./STEP2_SUMMARY.md).
- **Step 3** — Google Places details drawer (hours, ratings, reviews, photos via official API). See [`STEP3_SUMMARY.md`](./STEP3_SUMMARY.md).
- **Step 4** — Result filters, compare tray, CSV/JSON/HTML exports (OSM only). See [`STEP4_SUMMARY.md`](./STEP4_SUMMARY.md).
- **Step 5** — Docker / Traefik polish, optional access-key gate. See [`STEP5_SUMMARY.md`](./STEP5_SUMMARY.md).
- **Later** — Google key enablement and follow-ups in [`TODO.md`](./TODO.md).

## License / attribution

OpenStreetMap data © OSM contributors (ODbL). Google content (when enabled) is display-only with required attribution and is never exported.
