# Overture Places: optional regional import

Overture Places is a **separate, exportable search lane**. It is not a live API and does not mix with OSM or Google results or exports. The official [Places guide](https://docs.overturemaps.org/guides/places/) describes a monthly global GeoParquet release, per-source licensing, incomplete attributes, duplicates and junk records. The app only searches regions that the operator has imported. No claim of exhaustive coverage is made.

## Import a region

The importer is an offline operator task; it uses DuckDB to read Overture's official public S3 GeoParquet with bbox predicate pushdown, then builds a locally indexed SQLite snapshot. It never downloads the whole global release into the container. **The query may still read substantial remote data and consume bandwidth/time** depending on the region. Install Python 3.10+ and run outside the web container:

```bash
python3 -m venv .venv-overture
.venv-overture/bin/pip install -r scripts/requirements-overture.txt
mkdir -p data/overture
.venv-overture/bin/python scripts/overture-import.py \
  --bbox '23.65,23.95,90.25,90.55' \
  --output data/overture/places.sqlite
```

The bbox order is **south,north,west,east**. Up to 5° per axis and **500,000** rows per snapshot; if the region is larger, split it or select one region at a time. Imports fail rather than silently truncate. The latest dated release is discovered from the official [STAC catalog](https://stac.overturemaps.org/catalog.json); pin with `--release YYYY-MM-DD.N` to reproduce an import. The first import installs DuckDB `spatial` and `httpfs` extensions and needs outbound network access to Overture S3 and DuckDB's extension repository. Disk use depends on row count; budget several GB of free space during import, and keep the SQLite file outside Git and Docker build context.

**Production Docker:** copy `scripts/` and `scripts/requirements-overture.txt` to the VPS with the repository, install Python dependencies on the host (or run the importer in a temporary Python environment). Set `OVERTURE_DATA_DIR=/opt/places-discovery/data/overture` and `OVERTURE_DB_PATH=/data/overture/places.sqlite` in the VPS `.env`. The Compose service mounts the directory **read-only**. Restart the web service after the import. Locally without Compose set `OVERTURE_DB_PATH` to the absolute path of the SQLite snapshot in `.env.local` and restart `next dev`. When absent, Overture search is visibly disabled; OSM and Google still work. `/api/health` reports whether a snapshot file exists.

Refresh manually on a monthly release: rerun the same command with the same bbox. The importer creates `.staging` and **atomically replaces** the old snapshot only when complete; it does not schedule network jobs in the HTTP search path. Avoid simultaneous imports into the same output. An import of another bbox *replaces* the prior region; there is no multi-region/global store yet. Searching outside the imported bbox produces no results, not a fallback to global querying.

## Provenance and exports

Only Overture's own fields are in its CSV/JSON/GeoJSON files. Each record includes the GERS ID, release, original source dataset names and source licenses from `sources[]`, category, and confidence; the export header/meta includes attribution to the Overture Maps Foundation. No Google Places, Foursquare **API**, BestTime or OSM data is copied to this lane. Overture's own dataset can contain a Foursquare-origin record; that is *not* Foursquare Premium API data. Preserve row-level provenance and consult the [official licensing guidance](https://docs.overturemaps.org/guides/places/#sources-and-licensing) before redistribution. OSM is ODbL and exported separately. No Overture->OSM/Google matching is performed. Category mapping is approximate: the app uses Overture's `taxonomy.hierarchy` and `basic_category`; custom keywords match name or category. At most 20,000 bbox candidates are returned per search; larger searches fail with an explicit narrow-area message, never a silently partial export.
