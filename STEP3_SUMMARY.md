# Step 3 summary — Google Places details

## What works

- Official **Places API (New)** only (no scraping): Text Search match + Place Details + photo proxy
- `GET /api/places/google/status` — whether `GOOGLE_MAPS_API_KEY` is set (never returns the key)
- `POST /api/places/google/lookup` — match an OSM place name near lat/lng, then load details
- `GET /api/places/google/[placeId]` — Place Details
- `GET /api/places/google/photo` — server-side photo proxy (API key stays on the server)
- **Detail drawer**: OSM fields + Google rating, review count, hours, reviews, photos, Maps link
- Works without a Google key: drawer shows a clear setup message; OSM search unchanged
- Google content is display-only with attribution; not for export

## How to run

```bash
cd ~/Desktop/places-discovery
cp .env.example .env   # set GOOGLE_MAPS_API_KEY for Google enrichment
npm install
npm run typecheck && npm run lint && npm test
npm run dev -- -p 3001
```

Open http://localhost:3001 — search OSM places, tap a result to open the detail drawer.

### Google Cloud checklist

1. Create/select a Cloud project
2. Enable **Places API (New)**
3. Create an API key restricted to Places API (New); put it in `GOOGLE_MAPS_API_KEY`
4. Optional: set application restrictions (IP / referrer) for production

## Out of scope (later)

Compare drawer, coverage insights across sources, CSV/JSON/HTML exports (Google fields excluded from export).

## What's next

PD-4: Compare / filters / open-data exports (OSM only in export files) — see [`STEP4_SUMMARY.md`](./STEP4_SUMMARY.md).
