import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const q = await pool.query(`SELECT DISTINCT district FROM daily_price_fact ORDER BY district LIMIT 20`);
  console.log('Districts:', JSON.stringify(q.rows));
  
  const q2 = await pool.query(`SELECT COUNT(*) as cnt, trade_date FROM daily_price_fact GROUP BY trade_date ORDER BY trade_date DESC`);
  console.log('By date:', JSON.stringify(q2.rows));

  const q3 = await pool.query(`SELECT district, market, state FROM daily_price_fact LIMIT 5`);
  console.log('Sample rows:', JSON.stringify(q3.rows));

  await pool.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
