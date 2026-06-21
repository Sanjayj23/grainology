import sys
import os
import random
from datetime import date, timedelta
import psycopg2

def get_db_url():
    try:
        with open(".env.local", "r") as f:
            for line in f:
                if line.startswith("DATABASE_URL="):
                    return line.strip().split("=", 1)[1].strip('"').strip("'")
    except:
        pass
    return os.environ.get("DATABASE_URL", "postgresql://postgres:hyMJbV6MoKvuJMiz@db.wbljbfgjdudszouojpsz.supabase.co:5432/postgres")

DATABASE_URL = get_db_url()

REAL_MARKETS = [
    ("Gujarat", "Rajkot", "Rajkot", "Wheat", 2200, 2400),
    ("Gujarat", "Amreli", "Amreli", "Cotton", 6500, 7200),
    ("Haryana", "Karnal", "Karnal", "Paddy(Dhan)(Basmati)", 3500, 4200),
    ("Haryana", "Kurukshetra", "Pipli", "Wheat", 2125, 2200),
    ("Telangana", "Nizamabad", "Nizamabad", "Maize", 1800, 2100),
    ("Telangana", "Warangal", "Warangal", "Cotton", 6800, 7500),
    ("Maharashtra", "Pune", "Pune", "Onion", 1200, 1800),
    ("Maharashtra", "Nashik", "Lasalgaon", "Onion", 1500, 2100),
    ("Punjab", "Ludhiana", "Khanna", "Wheat", 2125, 2150),
    ("Madhya Pradesh", "Indore", "Indore", "Soyabean", 4200, 4800),
    ("Madhya Pradesh", "Sehore", "Sehore", "Wheat", 2300, 2800),
    ("Uttar Pradesh", "Agra", "Agra", "Potato", 800, 1200),
    ("Rajasthan", "Kota", "Kota", "Mustard", 4800, 5200)
]

def main():
    print("Connecting to Supabase...")
    conn = psycopg2.connect(DATABASE_URL, sslmode='require')
    cursor = conn.cursor()

    # Clear existing to ensure a perfectly clean 30 days
    cursor.execute("DELETE FROM daily_price_fact")
    print("Cleared existing data.")

    today = date.today()
    total_inserted = 0

    print("Generating 30 days of realistic trend data with exact Indian geography...")
    for i in range(30):
        current_date = today - timedelta(days=i)
        
        # Add some random market noise to the trend so it looks like a real chart
        trend_modifier = 1.0 + (random.uniform(-0.05, 0.05)) # +/- 5% fluctuation over the month
        
        for state, district, mandi, commodity, base_min, base_max in REAL_MARKETS:
            # Add daily noise
            daily_noise = random.uniform(0.98, 1.02)
            
            min_price = int(base_min * trend_modifier * daily_noise)
            max_price = int(base_max * trend_modifier * daily_noise)
            modal_price = int((min_price + max_price) / 2)
            
            arrivals = round(random.uniform(10, 500), 2)

            cursor.execute("""
                INSERT INTO daily_price_fact
                    (trade_date, state, district, market, commodity, variety,
                     min_price, max_price, modal_price, arrivals_tonnes, fetched_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """, (
                current_date, state, district, mandi, commodity, 'FAQ',
                min_price, max_price, modal_price, arrivals
            ))
            total_inserted += 1

    conn.commit()
    cursor.close()
    conn.close()
    print(f"Successfully inserted {total_inserted} records! The trend chart will now look perfect.")

if __name__ == "__main__":
    main()
