import { Pool } from 'pg';
import { NextRequest, NextResponse } from 'next/server';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const state = searchParams.get('state');
  const district = searchParams.get('district');
  const commodity = searchParams.get('commodity');

  if (!state || !district) {
    return NextResponse.json({ error: "Missing required parameters: state, district" }, { status: 400 });
  }

  try {
    let query = `
      SELECT trade_date, market, commodity, min_price, max_price, modal_price 
      FROM daily_price_fact 
      WHERE state = $1 AND district = $2
    `;
    const params: any[] = [state, district];

    if (commodity && commodity !== 'ALL') {
      query += ` AND commodity = $3`;
      params.push(commodity);
    }

    query += ` ORDER BY trade_date DESC, commodity ASC`;

    const result = await pool.query(query, params);
    return NextResponse.json({ success: true, data: result.rows });
    
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
