const { Client } = require('pg');
const fs = require('fs');

function getDbUrl() {
    try {
        const env = fs.readFileSync('.env.local', 'utf8');
        const match = env.match(/DATABASE_URL="([^"]+)"/);
        if (match) return match[1];
    } catch (e) {}
    return process.env.DATABASE_URL || "postgresql://postgres:hyMJbV6MoKvuJMiz@db.wbljbfgjdudszouojpsz.supabase.co:5432/postgres";
}

const REAL_MARKETS = [
  { state: "Gujarat", district: "Rajkot", mandi: "Rajkot", commodity: "Wheat", min: 2200, max: 2400 },
  { state: "Gujarat", district: "Amreli", mandi: "Amreli", commodity: "Cotton", min: 6500, max: 7200 },
  { state: "Haryana", district: "Karnal", mandi: "Karnal", commodity: "Paddy(Dhan)(Basmati)", min: 3500, max: 4200 },
  { state: "Haryana", district: "Kurukshetra", mandi: "Pipli", commodity: "Wheat", min: 2125, max: 2200 },
  { state: "Telangana", district: "Nizamabad", mandi: "Nizamabad", commodity: "Maize", min: 1800, max: 2100 },
  { state: "Telangana", district: "Warangal", mandi: "Warangal", commodity: "Cotton", min: 6800, max: 7500 },
  { state: "Maharashtra", district: "Pune", mandi: "Pune", commodity: "Onion", min: 1200, max: 1800 },
  { state: "Maharashtra", district: "Nashik", mandi: "Lasalgaon", commodity: "Onion", min: 1500, max: 2100 },
  { state: "Punjab", district: "Ludhiana", mandi: "Khanna", commodity: "Wheat", min: 2125, max: 2150 },
  { state: "Madhya Pradesh", district: "Indore", mandi: "Indore", commodity: "Soyabean", min: 4200, max: 4800 },
  { state: "Madhya Pradesh", district: "Sehore", mandi: "Sehore", commodity: "Wheat", min: 2300, max: 2800 },
  { state: "Uttar Pradesh", district: "Agra", mandi: "Agra", commodity: "Potato", min: 800, max: 1200 },
  { state: "Rajasthan", district: "Kota", mandi: "Kota", commodity: "Mustard", min: 4800, max: 5200 }
];

async function main() {
  console.log("Connecting to Supabase...");
  const client = new Client({
    connectionString: getDbUrl(),
    ssl: { rejectUnauthorized: false }
  });
  
  await client.connect();

  await client.query('DELETE FROM daily_price_fact');
  console.log("Cleared existing data.");

  let totalInserted = 0;
  const today = new Date();

  console.log("Generating 30 days of realistic trend data with exact Indian geography...");
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    
    const trendModifier = 1.0 + (Math.random() * 0.1 - 0.05);
    
    for (const m of REAL_MARKETS) {
      const dailyNoise = 0.98 + (Math.random() * 0.04);
      
      const minPrice = Math.floor(m.min * trendModifier * dailyNoise);
      const maxPrice = Math.floor(m.max * trendModifier * dailyNoise);
      const modalPrice = Math.floor((minPrice + maxPrice) / 2);
      
      const arrivals = Math.round((10 + Math.random() * 490) * 100) / 100;

      await client.query(`
        INSERT INTO daily_price_fact
            (trade_date, state, district, market, commodity, variety,
             min_price, max_price, modal_price, arrivals_tonnes, fetched_at)
        VALUES (
            $1, $2, $3, $4, $5, 'FAQ',
            $6, $7, $8, $9, NOW()
        )
      `, [dateStr, m.state, m.district, m.mandi, m.commodity, minPrice, maxPrice, modalPrice, arrivals]);
      
      totalInserted++;
    }
  }

  console.log(`Successfully inserted ${totalInserted} records!`);
  await client.end();
}

main().catch(console.error);
