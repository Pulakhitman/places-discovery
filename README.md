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
| `GOOGLE_MAPS_API_KEY` | Server Places API (New) — later steps |
| `GOOGLE_MAPS_BROWSER_KEY` | Optional Maps JS in the same map container |
| `DOMAIN`, `TRAEFIK_*` | Traefik / Docker labels |
| `AUTH_USER`, `AUTH_PASSWORD` | Optional Basic Auth pair |

Respect Nominatim and Overpass usage policies on public instances.

## Docker

```bash
cp .env.example .env
# Ensure external Traefik network exists: docker network create traefik
docker compose build
docker compose up -d
```

Compose uses `expose: ["3000"]` (no host `ports`) for Traefik. Health: `GET /api/health`.

## Status

- **Step 1** — Scaffold, location hierarchy (full dropdowns), single Leaflet map. See [`STEP1_SUMMARY.md`](./STEP1_SUMMARY.md).
- **Step 2** — Overpass nearby search, results list, markers + card sync, coverage. See [`STEP2_SUMMARY.md`](./STEP2_SUMMARY.md).

## License / attribution

OpenStreetMap data © OSM contributors (ODbL). Google content (when enabled later) is display-only with required attribution and is never exported.
