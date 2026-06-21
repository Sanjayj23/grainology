"""
Scraper for vegetablemarketprice.com
Extracts real live retail prices.
"""

import urllib.request
import json
import logging
from bs4 import BeautifulSoup
from pathlib import Path
from datetime import datetime
import re
from normalize import normalize_commodity

logger = logging.getLogger(__name__)

def scrape_vegetablemarketprice():
    url = "https://vegetablemarketprice.com/market/delhi/today"
    
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            html = response.read().decode('utf-8')
    except Exception as e:
        logger.error(f"Failed to fetch vegetablemarketprice.com: {e}")
        return
        
    soup = BeautifulSoup(html, 'html.parser')
    rows = soup.select('tr.todayVegetableTableRows')
    
    out_dir = Path(__file__).parent.parent / "data" / "latest"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    results = []
    
    for row in rows:
        cells = row.find_all('td')
        if len(cells) < 5:
            continue
            
        raw_name = cells[1].get_text(strip=True)
        raw_price = cells[2].get_text(strip=True)
        
        # Extract number from price, e.g., "₹29" -> 29.0
        price_match = re.search(r'[\d\.]+', raw_price)
        if not price_match:
            continue
            
        price_val = float(price_match.group(0))
        
        canonical_name, resolved, stage = normalize_commodity(raw_name, source_website="vegetablemarketprice.com")
        
        if resolved:
            results.append({
                "date": today_str,
                "state": "Delhi",
                "district": "Delhi",
                "market": "Delhi Retail",
                "commodity": canonical_name,
                "price_min": price_val,
                "price_max": price_val,
                "price_modal": price_val,
                "resolution_stage": stage
            })
            
    out_file = out_dir / "vegetablemarketprice.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
        
    logger.info(f"Saved {len(results)} records to {out_file}")
    print(f"vegetablemarketprice.com: successfully scraped {len(results)} live commodities.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    scrape_vegetablemarketprice()
