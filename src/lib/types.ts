export type Source = 'agmarknet' | 'enam' | 'datagovin' | 'indiadataportal' | 'vegetablemarketprice';

export const SOURCES: Source[] = ['agmarknet', 'enam', 'datagovin', 'indiadataportal', 'vegetablemarketprice'];

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
  source: PriceRecord['source'];
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
  agmarknet?: number;
  enam?: number;
  datagovin?: number;
  indiadataportal?: number;
  vegetablemarketprice?: number;
}

export interface SourceMeta {
  id: PriceRecord['source'];
  label: string;
  color: string;
  description: string;
  url: string;
}

export const SOURCE_META: Record<PriceRecord['source'], SourceMeta> = {
  agmarknet: {
    id: 'agmarknet',
    label: 'Agmarknet',
    color: '#22c55e',
    description: 'Govt. wholesale mandi prices (2000+ markets)',
    url: 'https://agmarknet.gov.in',
  },
  enam: {
    id: 'enam',
    label: 'eNAM',
    color: '#3b82f6',
    description: 'National Agriculture Market live prices',
    url: 'https://enam.gov.in',
  },
  datagovin: {
    id: 'datagovin',
    label: 'data.gov.in',
    color: '#f59e0b',
    description: 'Open Government Data Platform India',
    url: 'https://data.gov.in',
  },
  indiadataportal: {
    id: 'indiadataportal',
    label: 'IndiaDataPortal',
    color: '#a855f7',
    description: 'ISB historical market price database',
    url: 'https://indiadataportal.com',
  },
  vegetablemarketprice: {
    id: 'vegetablemarketprice',
    label: 'Vegetable Market Price',
    color: '#10b981',
    description: 'Live retail vegetable prices',
    url: 'https://vegetablemarketprice.com',
  },
};
