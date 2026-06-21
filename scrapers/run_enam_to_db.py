"""
Standalone runner: scrapes eNAM live prices using Playwright and
writes results directly into the Supabase PostgreSQL database.
"""
from __future__ import annotations
import logging
import sys
import os
from datetime import date
from urllib.parse import urlparse

# Make sure we can import from the scrapers directory
sys.path.insert(0, os.path.dirname(__file__))

from playwright.sync_api import sync_playwright
from enam_scraper import scrape_enam

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

try:
    import psycopg2
except ImportError:
    logger.error("psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    # Try loading from .env manually
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL="):
                    DATABASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

if not DATABASE_URL:
    logger.error("DATABASE_URL not set.")
    sys.exit(1)


def upsert_records(records, conn):
    cursor = conn.cursor()
    inserted = 0
    for r in records:
        try:
            cursor.execute("""
                INSERT INTO daily_price_fact
                    (trade_date, state, district, market, commodity, variety,
                     min_price, max_price, modal_price, arrivals_tonnes, fetched_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (trade_date, market, commodity) DO UPDATE SET
                    min_price = EXCLUDED.min_price,
                    max_price = EXCLUDED.max_price,
                    modal_price = EXCLUDED.modal_price,
                    arrivals_tonnes = EXCLUDED.arrivals_tonnes,
                    variety = EXCLUDED.variety,
                    fetched_at = EXCLUDED.fetched_at
            """, (
                r.price_date,
                r.state,
                r.district,
                r.market,
                r.commodity,
                r.variety or '',
                r.min_price,
                r.max_price,
                r.modal_price,
                r.arrivals_tonnes,
                r.fetched_at,
            ))
            inserted += 1
        except Exception as e:
            logger.warning(f"  Row skipped: {e} — {r.commodity} {r.market}")
    conn.commit()
    cursor.close()
    return inserted


def main():
    import argparse
    from datetime import timedelta
    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill-days", type=int, default=0)
    args = parser.parse_args()

    logger.info(f"Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    logger.info("Connected!")

    days_to_scrape = args.backfill_days
    if days_to_scrape == 0:
        dates = [date.today()]
    else:
        dates = [date.today() - timedelta(days=i) for i in range(days_to_scrape)]

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()

        for target_date in dates:
            logger.info(f"Running eNAM scraper for {target_date}...")
            records = scrape_enam(target_date, page)
            logger.info(f"Scraper returned {len(records)} records for {target_date}")
            if records:
                inserted = upsert_records(records, conn)
                logger.info(f"Inserted/updated {inserted} records into database")
            
        browser.close()

    conn.close()

if __name__ == "__main__":
    main()
