# Step 5 summary — Deploy / ops polish (complete the app)

## What works

- Docker image installs `wget` so container healthchecks work on Alpine
- `docker-compose.yml` Traefik labels + basic security headers middleware
- `docker-compose.local.yml` — run on host port **3001** without an external Traefik network
- Optional **ACCESS_KEY** gate (unlock page + httpOnly cookie); `/api/health` stays public
- Health payload reports `googlePlacesConfigured` / `accessKeyConfigured` (booleans only)
- `TODO.md` parks Google enablement and other follow-ups for later

## How to run (local Docker)

```bash
cd ~/Desktop/places-discovery
cp .env.example .env   # optional keys
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

Open http://localhost:3001 — health: http://localhost:3001/api/health

## How to run (Traefik)

```bash
docker network create traefik   # once
cp .env.example .env            # set DOMAIN, TRAEFIK_*
docker compose up --build -d
```

## App feature status

| Step | Status |
| --- | --- |
| 1 Scaffold + location + map | Done |
| 2 Overpass discovery | Done |
| 3 Google details drawer (code) | Done — key optional / later |
| 4 Filters, compare, OSM exports | Done |
| 5 Docker / Traefik / auth polish | Done (this step) |

## Later (see `TODO.md`)

Google Cloud key setup, optional Maps JS tiles, PR merges to `main`.
