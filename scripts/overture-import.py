#!/usr/bin/env python3
"""Import a bounded Overture Places release into a local SQLite snapshot.

Run outside the web server: pip install -r scripts/requirements-overture.txt.
No Google, Foursquare API or BestTime data is used or imported.
"""

import argparse
import json
import os
import math
import re
import sqlite3
import sys
import urllib.request
from pathlib import Path

import duckdb

CATALOG = "https://stac.overturemaps.org/catalog.json"
S3_ROOT = "s3://overturemaps-us-west-2/release"
MAX_SPAN_DEGREES = 5.0
MAX_ROWS = 500_000
INSERT_BATCH = 1_000


def latest_release():
    with urllib.request.urlopen(CATALOG, timeout=15) as response:
        catalog = json.load(response)
    release = catalog.get("latest")
    if not isinstance(release, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}\.\d+", release):
        raise ValueError("STAC catalog has no valid latest release")
    return release


def bounds(value):
    parts = [float(part) for part in value.split(",")]
    if len(parts) != 4:
        raise ValueError("bbox must be south,north,west,east")
    south, north, west, east = parts
    if not all(math.isfinite(part) for part in parts) or not (-90 <= south < north <= 90 and -180 <= west < east <= 180):
        raise ValueError("invalid bbox; antimeridian-crossing boxes are not supported")
    if north - south > MAX_SPAN_DEGREES or east - west > MAX_SPAN_DEGREES:
        raise ValueError("bbox too wide; split into regions of at most 5 degrees per side")
    return parts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bbox", required=True, help="south,north,west,east (max 5 degrees each side)")
    parser.add_argument("--output", required=True, help="SQLite snapshot; replace atomically")
    parser.add_argument("--release", help="Pin a dated release; default: STAC latest")
    parser.add_argument("--max-rows", type=int, default=MAX_ROWS, help="Abort instead of silently truncating")
    args = parser.parse_args()
    south, north, west, east = bounds(args.bbox)
    if not 1 <= args.max_rows <= MAX_ROWS:
        parser.error(f"max-rows must be between 1 and {MAX_ROWS}")
    release = args.release or latest_release()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}\.\d+", release):
        parser.error("release must be a dated Overture release (YYYY-MM-DD.N)")
    output = Path(args.output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    staging = output.with_name(output.name + ".staging")
    if staging.exists():
        parser.error(f"staging file already exists: {staging}; remove it after checking for another importer")
    remote = f"{S3_ROOT}/{release}/theme=places/type=place/*"
    print(f"Importing {release} {args.bbox} from {remote}", file=sys.stderr)

    db = None
    con = None
    try:
        db = duckdb.connect()
        db.execute("INSTALL spatial; LOAD spatial; INSTALL httpfs; LOAD httpfs")
        db.execute("SET s3_region='us-west-2'")
        # Constrain DuckDB and prevent oversized accidental global scans / downloads.
        db.execute("SET memory_limit='1GB'")
        db.execute("SET threads=2")
        db.execute("SET preserve_insertion_order=false")
        # read_parquet uses GeoParquet bbox row-group statistics for spatial pruning.
        # A count check is intentional: never publish a silently partial extract.
        query = """
            SELECT id, names.primary AS name, bbox.xmin AS lng, bbox.ymin AS lat,
                   taxonomy.primary AS taxonomy, taxonomy.hierarchy AS hierarchy,
                   basic_category, confidence, operating_status,
                   addresses[1].freeform AS address, websites[1] AS website,
                   phones[1] AS phone, to_json(sources) AS sources_json
            FROM read_parquet(?, hive_partitioning=1)
            WHERE bbox.xmin BETWEEN ? AND ? AND bbox.ymin BETWEEN ? AND ?
              AND names.primary IS NOT NULL
            LIMIT ?
        """
        results = db.execute(query, [remote, west, east, south, north, args.max_rows + 1])
        con = sqlite3.connect(staging)
        con.execute("CREATE TABLE metadata (release TEXT NOT NULL, bbox TEXT NOT NULL, row_count INTEGER NOT NULL)")
        con.execute("""CREATE TABLE places (
            id TEXT PRIMARY KEY, name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
            taxonomy TEXT, hierarchy_json TEXT, basic_category TEXT, confidence REAL,
            operating_status TEXT, address TEXT, website TEXT, phone TEXT, sources_json TEXT NOT NULL
        )""")
        count = 0
        while batch := results.fetchmany(INSERT_BATCH):
            count += len(batch)
            if count > args.max_rows:
                raise ValueError(f"more than {args.max_rows} records in bbox; split into smaller regions")
            rows = [tuple(row[:5]) + (json.dumps(row[5]) if row[5] is not None else None,) + tuple(row[6:]) for row in batch]
            con.executemany("INSERT INTO places VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
        con.execute("CREATE INDEX places_bbox ON places(lat, lng)")
        con.execute("INSERT INTO metadata VALUES (?, ?, ?)", (release, args.bbox, count))
        con.commit()
        con.close()
        con = None
        db.close()
        db = None
        os.replace(staging, output)
        print(f"Published {count} places to {output} (release {release})")
    except Exception:
        if con is not None:
            con.close()
        if db is not None:
            db.close()
        staging.unlink(missing_ok=True)
        raise


if __name__ == "__main__":
    main()
