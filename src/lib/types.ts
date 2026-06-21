export type Source = 'enam';

export const SOURCES: Source[] = ['enam'];

export interface PriceRecord {
  source: Source;
  fetched_at: string; // ISO datetime UTC
  price_date: string; // YYYY-MM-DD
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  min_price: number;
  max_price: number;
  modal_price: number;
  arrivals_tonnes: number | null;
  raw_source_name: string;
}

export interface ScrapeLogEntry {
  run_id: string;
  source: string;
  started_at: string;
  finished_at: string;
  records_fetched: number;
  records_valid: number;
  records_rejected: number;
  status: 'success' | 'partial' | 'failed';
  error_message: string;
}

export interface FilterState {
  state: string;
  district: string;
  market: string;
  commodity: string;
  variety: string;
  date: string; // YYYY-MM-DD or empty for latest
}

export interface ComparisonRow {
  source: Source;
  label: string;
  color: string;
  min_price: number | null;
  max_price: number | null;
  modal_price: number | null;
  arrivals_tonnes: number | null;
  price_date: string;
  fetched_at: string;
  available: boolean;
}

export interface TrendDataPoint {
  date: string;
  enam?: number;
}

export interface SourceMeta {
  id: Source;
  label: string;
  color: string;
  description: string;
  url: string;
}

export const SOURCE_META: Record<Source, SourceMeta> = {
  enam: {
    id: 'enam',
    label: 'eNAM',
    color: '#3b82f6',
    description: 'National Agriculture Market – live prices from 1,000+ mandis',
    url: 'https://enam.gov.in',
  },
};
