import sys
import os
from datetime import date, timedelta
from playwright.sync_api import sync_playwright

sys.path.insert(0, os.path.dirname(__file__))
from enam_scraper import scrape_enam

def main():
    target_date = date.today() - timedelta(days=5)
    print(f"Testing eNAM scraper for {target_date}...")
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        records = scrape_enam(target_date, page)
        print(f"Returned {len(records)} records")
        if records:
            print(f"Sample: {records[0]}")
        browser.close()

if __name__ == "__main__":
    main()
