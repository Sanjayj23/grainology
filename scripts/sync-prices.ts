import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// Load .env from current working directory
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runPipeline() {
  console.log("Starting daily e-NAM synchronization...");
  if (!process.env.DATABASE_URL) {
      console.error("Missing DATABASE_URL. Please set it in .env before running this script.");
      process.exit(1);
  }

  const client = await pool.connect();

  try {
    const targetUrl = 'https://enam.gov.in/web/Ajax_ctrl/trade_data_list';
    
    // Format: 2026-06-21
    const today = new Date().toISOString().split('T')[0];
    
    // Form-data request structure based on network intercept
    const params = new URLSearchParams();
    params.append('language', 'en');
    params.append('stateName', '');
    params.append('commodityName', '');
    params.append('apmcName', '');
    params.append('fromDate', 'NA');
    params.append('toDate', today);
    
    console.log("Fetching live data from eNAM with params:", params.toString());
    
    let rawData;
    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: params.toString()
      });
      rawData = await response.json();
      if (rawData && rawData.status === 500) {
        throw new Error("API returned 500 status");
      }
    } catch (e) {
      console.log("Live API blocked request. Falling back to local data/latest/enam.json from Playwright scraper...");
      const fs = await import('fs');
      const path = await import('path');
      const fallbackPath = path.resolve(process.cwd(), 'data/latest/enam.json');
      if (fs.existsSync(fallbackPath)) {
         rawData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      } else {
         throw new Error("No fallback data found.");
      }
    }
    
    // The Python JSON outputs an array of objects directly
    const rows = rawData.data || rawData.records || rawData;

    if (!rows || !Array.isArray(rows)) {
      console.error("DEBUG rawData:", rawData);
      throw new Error("Invalid response structural format received from remote server.");
    }

    await client.query('BEGIN');
    console.log(`Processing ${rows.length} data rows from e-NAM...`);
    
    const insertQuery = `
      INSERT INTO daily_price_fact (trade_date, state, district, market, commodity, min_price, max_price, modal_price)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (trade_date, market, commodity) 
      DO UPDATE SET 
        min_price = EXCLUDED.min_price,
        max_price = EXCLUDED.max_price,
        modal_price = EXCLUDED.modal_price;
    `;

    let inserted = 0;
    for (const row of rows) {
      // Handle standard API format vs Python JSON format
      const tradeDate = row.tradeDate || row.price_date || row.created_at?.split(' ')[0] || today;
      const stateName = row.stateName || row.state || '';
      const districtName = row.districtName || row.district || '';
      const apmcName = row.apmcName || row.apmc || row.mandiName || row.market || '';
      const commodityName = row.commodityName || row.commodity || '';
      
      const minP = parseFloat((row.minPrice || row.min_price || '0').toString().replace(/,/g, '')) || 0;
      const maxP = parseFloat((row.maxPrice || row.max_price || '0').toString().replace(/,/g, '')) || 0;
      const modalP = parseFloat((row.modalPrice || row.modal_price || '0').toString().replace(/,/g, '')) || 0;

      if (!stateName || !commodityName) continue;

      const values = [
        tradeDate, 
        stateName, 
        districtName, 
        apmcName, 
        commodityName, 
        minP, 
        maxP, 
        modalP || maxP
      ];
      await client.query(insertQuery, values);
      inserted++;
    }

    console.log(`Successfully inserted/updated ${inserted} records.`);

    console.log("Pruning legacy records outside the 30-day operational window...");
    const pruneQuery = `DELETE FROM daily_price_fact WHERE trade_date < CURRENT_DATE - INTERVAL '30 days';`;
    const pruneResult = await client.query(pruneQuery);
    console.log(`Pruning cycle complete. Removed ${pruneResult.rowCount} legacy rows.`);

    await client.query('COMMIT');
    console.log("Database synchronization completed successfully.");

  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error("Pipeline failure executed rollback:", error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runPipeline();
