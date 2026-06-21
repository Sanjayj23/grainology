import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const migrations = [
    `ALTER TABLE daily_price_fact ADD COLUMN IF NOT EXISTS variety VARCHAR(100) DEFAULT ''`,
    `ALTER TABLE daily_price_fact ADD COLUMN IF NOT EXISTS arrivals_tonnes DECIMAL(12, 2)`,
    `ALTER TABLE daily_price_fact ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ DEFAULT NOW()`,
  ];
  for (const sql of migrations) {
    console.log('Running migration:', sql.substring(0, 70) + '...');
    try {
      await pool.query(sql);
      console.log('  ✓ Done');
    } catch (e: any) {
      console.error('  ✗ Failed:', e.message);
    }
  }
  const cols = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns 
     WHERE table_name = 'daily_price_fact' ORDER BY ordinal_position`
  );
  console.log('\nFinal columns:', cols.rows.map((r: any) => r.column_name).join(', '));
  await pool.end();
}
run();
