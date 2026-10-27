# Step 1 summary — Places Discovery

## What works

- Next.js App Router + TypeScript + ESLint + Vitest
- Scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `test`
- `.env.example` with `GOOGLE_MAPS_*`, `NOMINATIM_URL`, `OVERPASS_URL`, `DOMAIN`, `TRAEFIK_*`, `AUTH_*`
- Location hierarchy UI:
  - Searchable complete ISO 3166 country list
  - Region / county / city: search → dropdown of Nominatim matches
  - Never auto-selects the first result; explicit pick only
  - Skip level; parent change invalidates children; breadcrumb
- Nominatim adapter (`NOMINATIM_URL`), timeouts, empty / error / rate-limit UI states
- **One** `MapWorkspace` (Leaflet + OSM tiles): world → selected area, draggable center pin, map click sets center, radius circle, OSM attribution
- Search shell: category + radius dropdowns (search is a stub)
- Minimal Dockerfile + `docker-compose.yml` with `expose` (not `ports`) and `/api/health`
- Unit tests for hierarchy invalidate/reset and no-auto-select

## How to run

```bash
cd ~/Desktop/places-discovery
npm install
npm run dev
```

**Local URL:** http://localhost:3000  
**Health:** http://localhost:3000/api/health

Also: `npm run typecheck && npm run lint && npm test`

## Out of scope (later steps)

- Overpass results list / OSM discovery
- Google Places search, details, hours, reviews, photos
- Compare, coverage insights, exports
- Optional Google Maps JS in the same map container
- Auth middleware wiring

## What's next

1. Overpass nearby search by category/radius + results UI  
2. Google Places (official API only) + detail drawer  
3. Compare / filters / coverage / open-data exports  
4. Traefik polish + Google Cloud enablement checklist  
