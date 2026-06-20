"""
Main orchestrator — runs all scrapers, validates output, writes data files,
and updates scrape_log.csv.
"""

from __future__ import annotations
import csv
import json
import logging
import os
import sys
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

# Add scrapers dir to path so imports work when run from repo root
sys.path.insert(0, str(Path(__file__).parent))

from schema import PriceRecord, ScrapeRun
from agmarknet_scraper import scrape_agmarknet
from datagovin_client import fetch_datagovin
from enam_scraper import scrape_enam
from indiadataportal_client import fetch_indiadataportal

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
logger = logging.getLogger("run_all")

# Paths relative to repo root
REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "data"
LATEST_DIR = DATA_DIR / "latest"
HISTORY_DIR = DATA_DIR / "history"
SCRAPE_LOG = DATA_DIR / "scrape_log.csv"

SCRAPE_LOG_FIELDS = [
    "run_id", "source", "started_at", "finished_at",
    "records_fetched", "records_valid", "records_rejected",
    "status", "error_message",
]


def ensure_dirs() -> None:
    for d in [LATEST_DIR, HISTORY_DIR, DATA_DIR / "reference"]:
        d.mkdir(parents=True, exist_ok=True)
    for source in ["agmarknet", "enam", "datagovin", "indiadataportal"]:
        (HISTORY_DIR / source).mkdir(parents=True, exist_ok=True)


def write_latest(source: str, records: list[PriceRecord]) -> None:
    out = [r.to_dict() for r in records]
    path = LATEST_DIR / f"{source}.json"
    path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info("Wrote %d records to %s", len(out), path)


def write_history(source: str, records: list[PriceRecord], run_date: date) -> None:
    path = HISTORY_DIR / source / f"{run_date.isoformat()}.csv"
    if not records:
        return
    fieldnames = list(records[0].to_dict().keys())
    mode = "w" if not path.exists() else "a"
    with open(path, mode, newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        if mode == "w":
            writer.writeheader()
        for r in records:
            writer.writerow(r.to_dict())
    logger.info("Wrote %d history rows to %s", len(records), path)


def append_scrape_log(run: ScrapeRun) -> None:
    write_header = not SCRAPE_LOG.exists()
    with open(SCRAPE_LOG, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=SCRAPE_LOG_FIELDS)
        if write_header:
            writer.writeheader()
        writer.writerow(run.to_dict())


def run_scraper(
    source: str,
    scraper_fn,
    target_date: date,
    page=None
) -> ScrapeRun:
    run_id = f"{source}-{uuid.uuid4().hex[:8]}"
    started_at = datetime.now(tz=timezone.utc)
    raw_records = []
    valid_records = []
    error_msg = ""

    logger.info("=== Starting %s ===", source)
    try:
        if page and source != "datagovin":
            raw_records = scraper_fn(target_date, page=page)
        else:
            raw_records = scraper_fn(target_date)
            
        valid_records = [r for r in raw_records if isinstance(r, PriceRecord)]

        if valid_records:
            write_latest(source, valid_records)
            write_history(source, valid_records, target_date)
            status = "success"
        else:
            status = "partial"
            error_msg = "No valid records returned"
            logger.warning("%s: no valid records for %s", source, target_date)

    except Exception as exc:
        status = "failed"
        error_msg = str(exc)
        logger.exception("%s: scraper raised exception: %s", source, exc)

    finished_at = datetime.now(tz=timezone.utc)
    rejected = len(raw_records) - len(valid_records)

    run = ScrapeRun(
        run_id=run_id,
        source=source,
        started_at=started_at,
        finished_at=finished_at,
        records_fetched=len(raw_records),
        records_valid=len(valid_records),
        records_rejected=rejected,
        status=status,
        error_message=error_msg,
    )

    append_scrape_log(run)
    logger.info(
        "=== %s done: status=%s valid=%d rejected=%d ===",
        source, status, len(valid_records), rejected
    )
    return run


def main() -> None:
    ensure_dirs()
    target_date = date.today()
    logger.info("Run date: %s", target_date)

    if not os.environ.get("DATAGOVIN_API_KEY"):
        logger.warning(
            "DATAGOVIN_API_KEY not set — data.gov.in client will fail. "
            "Set this in GitHub Actions secrets."
        )

    scrapers = [
        ("datagovin", fetch_datagovin),
        ("agmarknet", scrape_agmarknet),
        ("enam", scrape_enam),
        ("indiadataportal", fetch_indiadataportal),
    ]

    results = []
    
    with sync_playwright() as p:
        logger.info("Launching Playwright Chromium Browser...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )
        page = context.new_page()
        
        # Route aborts for images/css to save bandwidth and speed up the scraper
        page.route("**/*", lambda route: route.abort() if route.request.resource_type in ["image", "media", "font"] else route.continue_())

        for source, fn in scrapers:
            run = run_scraper(source, fn, target_date, page=page)
            results.append(run)
            
        browser.close()

    success = sum(1 for r in results if r.status == "success")
    partial = sum(1 for r in results if r.status == "partial")
    failed  = sum(1 for r in results if r.status == "failed")
    total_records = sum(r.records_valid for r in results)

    logger.info(
        "SUMMARY: %d sources success, %d partial, %d failed | %d total valid records",
        success, partial, failed, total_records
    )

    sys.exit(0)


if __name__ == "__main__":
    main()
