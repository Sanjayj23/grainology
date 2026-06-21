import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Deleting all records...');
  const res = await pool.query('DELETE FROM daily_price_fact');
  console.log('Deleted rows:', res.rowCount);
  
  const check = await pool.query('SELECT COUNT(*) as cnt FROM daily_price_fact');
  console.log('Remaining rows:', check.rows[0].cnt);
  
  await pool.end();
}
run().catch(e => { console.error('Error:', e.message); process.exit(1); });
