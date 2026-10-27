# To-do later (not blocking app completion)

Parked items — finish the shippable app first (PD-5), then do these when ready.

## Google Places (enable when you want ratings/reviews)

- [ ] Create/select a Google Cloud project
- [ ] Enable billing on the project
- [ ] Enable **Places API (New)**
- [ ] Create an API key → restrict to Places API (New)
- [ ] `cp .env.example .env` and set `GOOGLE_MAPS_API_KEY=…`
- [ ] Restart `npm run dev -- -p 3001` → banner should say “Google Places details: on”
- [ ] Optional: set application restrictions (IP / HTTP referrer) for production
- [ ] Optional: `GOOGLE_MAPS_BROWSER_KEY` if adding Maps JavaScript tiles later

## Optional product / ops follow-ups

- [ ] Optional Google Maps JS basemap in the same Leaflet map container
- [ ] Coverage insights that compare OSM vs Google field presence (display only)
- [ ] Stronger Traefik edge Basic Auth (in addition to app middleware)
- [ ] Multi-user accounts (replace optional shared Basic Auth)
- [ ] Merge stacked PRs (#1→#2→#3→#4→#5) into `main` when ready

## Already done (Steps 1–4)

- Scaffold, location hierarchy, single map
- Overpass search, results, markers, placeholders
- Google details drawer (code ready; needs key above)
- Filters, sort, compare, OSM-only CSV/JSON/HTML exports
