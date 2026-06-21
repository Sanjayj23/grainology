import { Pool } from 'pg';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
      console.log("Connecting to", process.env.DATABASE_URL);
      const sql = fs.readFileSync('scripts/schema.sql', 'utf-8');
      console.log("Read schema length:", sql.length);
      await pool.query(sql);
      console.log('Schema initialized successfully!');
  } catch (e: any) {
      console.error("Failed to init DB:", e.message);
  } finally {
      await pool.end();
  }
}
run();
