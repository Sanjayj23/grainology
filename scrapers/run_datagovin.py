import sys
from datetime import date
import logging
from pathlib import Path
import json

sys.path.insert(0, 'scrapers')
logging.basicConfig(level=logging.INFO)

from datagovin_client import fetch_datagovin

records = fetch_datagovin(target_date=date.today())
print(f"Fetched {len(records)} records from data.gov.in")

if records:
    out = [r.to_dict() for r in records]
    Path('data/latest/datagovin.json').write_text(
        json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8'
    )
    print("Saved to data/latest/datagovin.json")
