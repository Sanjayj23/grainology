export interface DashboardFilterResponse {
  cmdt_data: any[];
  grade_data: any[];
  state_data: any[];
  market_data: any[];
}

export interface MarketwisePayload {
  dashboard: string;
  date: string;
  group: number[];
  commodity: number[];
  variety: number;
  state: number;
  district: number[];
  market: number[];
  grades: number[];
  limit: number;
  format?: string;
  force?: boolean;
}

export interface AgmarknetRawResponse {
  status: string;
  message: string;
  pagination: any;
  data: {
    columns: any[];
    records: any[];
    count: any;
  };
}

export interface NormalizedRecord {
  commodity_group: string;
  commodity: string;
  msp_price_rs_per_quintal: number | null;
  reported_date: string;
  trend: string;
  price: {
    as_on: { title: string; value: number | null };
    one_day_ago: { title: string; value: number | null };
    two_day_ago: { title: string; value: number | null };
  };
  arrival_metric_tonnes: {
    as_on: { title: string; value: number | null };
    one_day_ago: { title: string; value: number | null };
    two_day_ago: { title: string; value: number | null };
  };
  msp_source?: 'agmarknet' | 'fallback';
  raw: any;
}
