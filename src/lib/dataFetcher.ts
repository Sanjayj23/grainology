import type {
  PriceRecord,
  ScrapeLogEntry,
  FilterState,
  TrendDataPoint,
  ComparisonRow,
} from './types';
import { SOURCE_META, SOURCES } from './types';

// ── Core API fetcher ──────────────────────────────────────────────

function buildApiUrl(filters: Partial<FilterState> = {}): string {
  const params = new URLSearchParams();
  if (filters.state && filters.state !== 'all') params.set('state', filters.state);
  if (filters.district && filters.district !== 'all') params.set('district', filters.district);
  if (filters.market && filters.market !== 'all') params.set('market', filters.market);
  if (filters.commodity && filters.commodity !== 'all') params.set('commodity', filters.commodity);
  if (filters.variety && filters.variety !== 'all') params.set('variety', filters.variety);
  if (filters.date) params.set('date', filters.date);
  const qs = params.toString();
  return `/api/prices${qs ? '?' + qs : ''}`;
}

async function fetchFromDB(filters: Partial<FilterState> = {}): Promise<PriceRecord[]> {
  try {
    const url = buildApiUrl(filters);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return json.success ? (json.data as PriceRecord[]) : [];
  } catch {
    return [];
  }
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Fetches ALL records from the DB (no filters) once on app boot.
 * Returns keyed by source name for compatibility with existing components.
 */
export async function fetchLatestAll(): Promise<Record<string, PriceRecord[]>> {
  const records = await fetchFromDB();
  return { enam: records };
}

/**
 * Fetches records for a specific set of filters.
 */
export async function fetchFiltered(filters: Partial<FilterState>): Promise<PriceRecord[]> {
  return fetchFromDB(filters);
}

/**
 * Generates a synthetic scrape-log entry based on DB data so the
 * FreshnessStrip shows when eNAM data was last synced.
 */
export function buildScrapeLogFromRecords(
  allData: Record<string, PriceRecord[]>
): ScrapeLogEntry[] {
  const records = allData['enam'] || [];
  if (!records.length) return [];
  const latest = [...records].sort((a, b) => b.fetched_at.localeCompare(a.fetched_at))[0];
  return [
    {
      run_id: 'enam-db-sync',
      source: 'enam',
      started_at: latest.fetched_at,
      finished_at: latest.fetched_at,
      records_fetched: records.length,
      records_valid: records.length,
      records_rejected: 0,
      status: 'success',
      error_message: '',
    },
  ];
}

// Compatibility shim – page.tsx still calls fetchScrapeLog
export async function fetchScrapeLog(): Promise<ScrapeLogEntry[]> {
  return [];
}

// ── Filter & compare logic ───────────────────────────────────────

export function applyFilters(
  records: PriceRecord[],
  filters: Partial<FilterState>
): PriceRecord[] {
  return records.filter(r => {
    if (filters.state && filters.state !== 'all' && r.state !== filters.state) return false;
    if (filters.district && filters.district !== 'all' && r.district !== filters.district) return false;
    if (filters.market && filters.market !== 'all' && r.market !== filters.market) return false;
    if (filters.commodity && filters.commodity !== 'all' && r.commodity !== filters.commodity) return false;
    if (filters.variety && filters.variety !== 'all' && r.variety !== filters.variety) return false;
    if (filters.date && r.price_date !== filters.date) return false;
    return true;
  });
}

export function buildComparisonRows(
  allData: Record<string, PriceRecord[]>,
  filters: Partial<FilterState>
): ComparisonRow[] {
  return SOURCES.map((source): ComparisonRow => {
    const meta = SOURCE_META[source];
    const filtered = applyFilters(allData[source] || [], filters);
    if (!filtered.length) {
      return {
        source,
        label: meta.label,
        color: meta.color,
        min_price: null,
        max_price: null,
        modal_price: null,
        arrivals_tonnes: null,
        price_date: '',
        fetched_at: '',
        available: false,
      };
    }
    // Use the most recent price_date, then pick lowest min & highest max across markets
    const latestDate = filtered.sort((a, b) => b.price_date.localeCompare(a.price_date))[0].price_date;
    const sameDate = filtered.filter(r => r.price_date === latestDate);
    const best = sameDate.reduce((acc, r) => ({
      ...acc,
      min_price: Math.min(acc.min_price ?? r.min_price, r.min_price),
      max_price: Math.max(acc.max_price ?? r.max_price, r.max_price),
      // weighted average modal price (simple average here)
      modal_price: (acc.modal_price + r.modal_price) / 2,
    }), { ...sameDate[0] });

    return {
      source,
      label: meta.label,
      color: meta.color,
      min_price: best.min_price,
      max_price: best.max_price,
      modal_price: Math.round(best.modal_price),
      arrivals_tonnes: best.arrivals_tonnes,
      price_date: latestDate,
      fetched_at: best.fetched_at,
      available: true,
    };
  });
}

export function buildTrendData(
  allData: Record<string, PriceRecord[]>,
  filters: Partial<FilterState>,
  days: number = 30
): TrendDataPoint[] {
  const dateMap: Record<string, TrendDataPoint> = {};

  SOURCES.forEach(source => {
    const filtered = applyFilters(allData[source] || [], {
      ...filters,
      date: undefined, // ignore single-date filter for trend
    });

    // For trend: group by date, average modal prices
    const byDate: Record<string, number[]> = {};
    filtered.forEach(r => {
      if (!byDate[r.price_date]) byDate[r.price_date] = [];
      if (r.modal_price > 0) byDate[r.price_date].push(r.modal_price);
    });

    Object.entries(byDate).forEach(([date, prices]) => {
      if (!dateMap[date]) dateMap[date] = { date };
      const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
      dateMap[date][source] = Math.round(avg);
    });
  });

  return Object.values(dateMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);
}

export function getUniqueValues(
  records: PriceRecord[],
  field: keyof PriceRecord
): string[] {
  return Array.from(new Set(records.map(r => String(r[field])).filter(Boolean))).sort();
}

export function getAggregatedOptions(
  allData: Record<string, PriceRecord[]>,
  field: keyof PriceRecord
): string[] {
  const allRecords = Object.values(allData).flat();
  return getUniqueValues(allRecords, field);
}

export function getLatestScrapePerSource(
  log: ScrapeLogEntry[]
): Record<string, ScrapeLogEntry> {
  const result: Record<string, ScrapeLogEntry> = {};
  [...log].reverse().forEach(entry => {
    if (!result[entry.source]) result[entry.source] = entry;
  });
  return result;
}
