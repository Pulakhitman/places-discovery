# Places Discovery

Self-hostable places intelligence workspace: pick an area on **one map**, then discover nearby places via OpenStreetMap (and official Google Places APIs in later steps).

**Hard rule:** no Google Maps HTML scraping or third-party scrapers.

## Local run

```bash
npm install
cp .env.example .env   # optional for local Nominatim defaults
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build & serve |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |

Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

## Environment variables

See [`.env.example`](./.env.example). Important keys:

| Variable | Purpose |
| --- | --- |
| `NOMINATIM_URL` | Geocoding base URL (default public Nominatim) |
| `OVERPASS_URL` | OSM Overpass (used in later steps) |
| `GOOGLE_MAPS_API_KEY` | Server Places API (New) — later steps |
| `GOOGLE_MAPS_BROWSER_KEY` | Optional Maps JS in the same map container |
| `DOMAIN`, `TRAEFIK_*` | Traefik / Docker labels |
| `AUTH_USER`, `AUTH_PASSWORD` | Optional Basic Auth pair |

Respect Nominatim usage policy when pointing at the public instance (set a clear `NOMINATIM_USER_AGENT`).

## Docker

```bash
cp .env.example .env
# Ensure external Traefik network exists: docker network create traefik
docker compose build
docker compose up -d
```

Compose uses `expose: ["3000"]` (no host `ports`) for Traefik. Health: `GET /api/health`.

## Step 1 status

Scaffold, location hierarchy (ISO country + Nominatim region/county/city), single Leaflet map, search shell, Docker, and tests. See [`STEP1_SUMMARY.md`](./STEP1_SUMMARY.md).

## License / attribution

OpenStreetMap data © OSM contributors (ODbL). Google content (when enabled later) is display-only with required attribution and is never exported.
