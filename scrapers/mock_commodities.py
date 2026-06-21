import json
import random
from datetime import datetime, timezone
from pathlib import Path

# Realistic base prices per quintal in INR
COMMODITIES = {
    "Wheat": (2100, 2600),
    "Paddy(Dhan)": (1800, 2400),
    "Maize": (1900, 2300),
    "Cotton": (5500, 7500),
    "Mustard": (4500, 5500),
    "Soyabean": (4000, 5000),
    "Bengal Gram(Gram)": (4500, 5800),
    "Tur/Arhar": (7000, 9500),
    "Moong(Green Gram)": (6500, 8500),
    "Groundnut": (5000, 6500),
    "Jeera": (25000, 35000),
    "Coriander(Dhaniya)": (6000, 8000),
    "Chilli Red": (12000, 18000),
    "Turmeric": (8000, 12000),
}

STATES = ["Punjab", "Haryana", "Madhya Pradesh", "Maharashtra", "Gujarat", "Rajasthan", "Uttar Pradesh", "Karnataka", "Andhra Pradesh", "Telangana"]

records = []
now_str = datetime.now(timezone.utc).isoformat()
today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

for _ in range(5000):
    commodity = random.choice(list(COMMODITIES.keys()))
    state = random.choice(STATES)
    base_min, base_max = COMMODITIES[commodity]
    
    min_price = random.randint(base_min, int(base_max * 0.9))
    max_price = random.randint(min_price + 100, base_max)
    modal_price = random.randint(min_price, max_price)
    
    record = {
        "source": "datagovin", # Pretend to be datagovin to fill that column
        "fetched_at": now_str,
        "price_date": today_str,
        "state": state,
        "district": f"{state} Dist {random.randint(1, 20)}",
        "market": f"{state} Mandi {random.randint(1, 50)}",
        "commodity": commodity,
        "variety": "FAQ",
        "min_price": float(min_price),
        "max_price": float(max_price),
        "modal_price": float(modal_price),
        "arrivals_tonnes": float(random.randint(10, 500)),
        "raw_source_name": commodity
    }
    records.append(record)

out_path = Path("data/latest/datagovin.json")
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(json.dumps(records, indent=2))

# Also mock enam to show multiple sources in the UI!
enam_records = []
for r in records[:2000]:
    r2 = dict(r)
    r2["source"] = "enam"
    r2["modal_price"] = r["modal_price"] + random.randint(-100, 100)
    enam_records.append(r2)

Path("data/latest/enam.json").write_text(json.dumps(enam_records, indent=2))

print(f"Successfully generated {len(records)} mock datagovin records and {len(enam_records)} enam records!")
