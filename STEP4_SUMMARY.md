# Step 4 summary — Filters, compare, OSM exports

## What works

- **Result filters**: named only, has address / hours / website / phone, max distance
- **Sort**: distance, name, or most tagged fields
- Filtered/sorted list drives the results panel, map markers, and exports
- Empty-filter state with one-click clear
- **Compare tray**: pin up to 3 places → side-by-side OSM table with differing rows highlighted + export
- **Exports**: CSV, JSON, HTML of the filtered (or compared) OSM list
  - Includes ODbL attribution
  - Explicit note that Google content is never exported
  - Download confirmation flash
- Search aborts in-flight requests; category/radius/sort remembered in localStorage
- Detail drawer: OSM.org link + copy coordinates
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

PD-5: Traefik / Docker polish + ops — see [`STEP5_SUMMARY.md`](./STEP5_SUMMARY.md). Google key setup is parked in [`TODO.md`](./TODO.md).
