-- 1. Create the Master Fact Table optimized for 30-day tracking
CREATE TABLE IF NOT EXISTS daily_price_fact (
    id SERIAL PRIMARY KEY,
    trade_date DATE NOT NULL,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    market VARCHAR(100) NOT NULL,
    commodity VARCHAR(100) NOT NULL,
    min_price DECIMAL(10, 2),
    max_price DECIMAL(10, 2),
    modal_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Prevent duplicate entries if the sync script runs multiple times a day
CREATE UNIQUE INDEX IF NOT EXISTS unique_mandi_trade 
ON daily_price_fact (trade_date, market, commodity);

-- 3. High-performance composite indexes for your frontend dashboard filters
CREATE INDEX IF NOT EXISTS idx_search_filters 
ON daily_price_fact (state, district, commodity, trade_date DESC);
