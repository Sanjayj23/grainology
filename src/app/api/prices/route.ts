import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const state = sp.get('state');
  const district = sp.get('district');
  const market = sp.get('market');
  const commodity = sp.get('commodity');
  const variety = sp.get('variety');
  const date = sp.get('date');

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (state && state !== 'all') {
      params.push(state);
      conditions.push(`state = $${params.length}`);
    }
    if (district && district !== 'all') {
      params.push(district);
      conditions.push(`district = $${params.length}`);
    }
    if (market && market !== 'all') {
      params.push(market);
      conditions.push(`market = $${params.length}`);
    }
    if (commodity && commodity !== 'all') {
      params.push(commodity);
      conditions.push(`commodity = $${params.length}`);
    }
    if (variety && variety !== 'all') {
      params.push(variety);
      conditions.push(`variety = $${params.length}`);
    }
    if (date) {
      params.push(date);
      conditions.push(`trade_date = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT
        TO_CHAR(trade_date, 'YYYY-MM-DD') AS price_date,
        state,
        district,
        market,
        commodity,
        COALESCE(variety, '')  AS variety,
        min_price,
        max_price,
        modal_price,
        arrivals_tonnes,
        fetched_at,
        'enam'          AS source,
        market          AS raw_source_name
      FROM daily_price_fact
      ${where}
      ORDER BY trade_date DESC, commodity ASC, market ASC
      LIMIT 5000
    `;

    const result = await pool.query(sql, params);

    // Shape rows so price numbers are real numbers not strings
    const rows = result.rows.map((r: Record<string, unknown>) => ({
      ...r,
      min_price: Number(r.min_price),
      max_price: Number(r.max_price),
      modal_price: Number(r.modal_price),
      arrivals_tonnes: r.arrivals_tonnes != null ? Number(r.arrivals_tonnes) : null,
      fetched_at: r.fetched_at ? String(r.fetched_at) : '',
    }));

    return NextResponse.json({ success: true, data: rows });
  } catch (error: unknown) {
    console.error('[/api/prices] DB error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
