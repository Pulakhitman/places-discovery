# Step 4 summary — Filters, compare, OSM exports

## What works

- **Result filters**: named only, has address / hours / website / phone, max distance
- Filtered list drives the results panel, map markers, and exports
- **Compare tray**: pin up to 3 places → side-by-side OSM field table (Esc to close)
- **Exports**: CSV, JSON, HTML of the filtered OSM list
  - Includes ODbL attribution
  - Explicit note that Google content is never exported
- Coverage % still reflects the full Overpass result set (before filters)

## How to run

```bash
cd ~/Desktop/places-discovery
npm install
npm run typecheck && npm run lint && npm test
npm run dev -- -p 3001
```

Open http://localhost:3001 — search, filter, Add to compare, export CSV/JSON/HTML.

## Out of scope (later)

Traefik polish, Google Cloud enablement checklist beyond Step 3, auth middleware, optional Maps JS tiles.

## What's next

PD-5: Traefik / Docker polish + Google Cloud enablement checklist (ops).
