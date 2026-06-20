import type { PriceRecord, ScrapeLogEntry, FilterState, TrendDataPoint, ComparisonRow } from './types';
import { SOURCE_META } from './types';

// GitHub username + repo — update before deploy
const GITHUB_USER = process.env.NEXT_PUBLIC_GITHUB_USER || 'Sanjayj23';
const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO || 'grainology';
const BRANCH = 'main';

// Primary: jsDelivr CDN (cached, fast, no CORS issues)
const CDN_BASE = `https://cdn.jsdelivr.net/gh/${GITHUB_USER}/${GITHUB_REPO}@${BRANCH}`;
// Fallback: raw GitHub (real-time but may have rate limits)
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${BRANCH}`;

const SOURCES = ['agmarknet', 'enam', 'datagovin', 'indiadataportal'] as const;

// ── Fetch helpers ────────────────────────────────────────────────

// In dev (localhost), data is served from /public/data/ as static assets.
// In production, it's fetched from GitHub CDN + raw.github fallback.
function getDataUrls(path: string): string[] {
  const isLocalhost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  if (isLocalhost) {
    return [`/${path}`]; // served by Next.js dev server from /public/
  }
  return [`${CDN_BASE}/${path}`, `${RAW_BASE}/${path}`];
}

async function fetchJSON<T>(path: string): Promise<T | null> {
  for (const url of getDataUrls(path)) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      return (await res.json()) as T;
    } catch { /* try next */ }
  }
  return null;
}

async function fetchText(path: string): Promise<string | null> {
  for (const url of getDataUrls(path)) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      return res.text();
    } catch { /* try next */ }
  }
  return null;
}


// ── CSV parser (handles quoted fields with commas) ────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const result: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h.trim()] = (values[idx] ?? '').trim();
    });
    result.push(obj);
  }
  return result;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}


// ── Public API ───────────────────────────────────────────────────

export async function fetchLatestAll(): Promise<Record<string, PriceRecord[]>> {
  const results: Record<string, PriceRecord[]> = {};
  await Promise.all(
    SOURCES.map(async (source) => {
      const data = await fetchJSON<PriceRecord[]>(`data/latest/${source}.json`);
      results[source] = data || [];
    })
  );
  return results;
}

export async function fetchLatestSource(source: string): Promise<PriceRecord[]> {
  return (await fetchJSON<PriceRecord[]>(`data/latest/${source}.json`)) || [];
}

export async function fetchScrapeLog(): Promise<ScrapeLogEntry[]> {
  const text = await fetchText('data/scrape_log.csv');
  if (!text) return [];
  return parseCSV(text) as unknown as ScrapeLogEntry[];
}

export async function fetchHistoryCSV(
  source: string,
  dateStr: string // YYYY-MM-DD
): Promise<PriceRecord[]> {
  const text = await fetchText(`data/history/${source}/${dateStr}.csv`);
  if (!text) return [];
  return parseCSV(text) as unknown as PriceRecord[];
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
    // Use the record with the most recent price_date
    const best = filtered.sort((a, b) => b.price_date.localeCompare(a.price_date))[0];
    return {
      source,
      label: meta.label,
      color: meta.color,
      min_price: best.min_price,
      max_price: best.max_price,
      modal_price: best.modal_price,
      arrivals_tonnes: best.arrivals_tonnes,
      price_date: best.price_date,
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
      date: undefined, // ignore date filter for trend
    });
    filtered.forEach(r => {
      if (!dateMap[r.price_date]) dateMap[r.price_date] = { date: r.price_date };
      const existing = dateMap[r.price_date][source];
      if (!existing || r.modal_price > 0) {
        dateMap[r.price_date][source] = r.modal_price;
      }
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
