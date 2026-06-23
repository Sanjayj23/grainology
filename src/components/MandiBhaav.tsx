import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, Download, Printer, RefreshCw, TrendingUp } from 'lucide-react';

interface AgmarknetFilterData {
  state_data?: Array<{ state_id: number; state_name: string }>;
  district_data?: Array<{ id?: number; district_id?: number; state_id: number; district_name: string }>;
  market_data?: Array<{ id: number; state_id?: number; district_id?: number; mkt_name: string }>;
  cmdt_group_data?: Array<{ id: number; cmdt_grp_name: string }>;
  group_data?: Array<{ group_id: number; group_name: string }>;
  cmdt_data?: Array<{ cmdt_id: number; cmdt_name: string; cmdt_group_id?: number }>;
  grade_data?: Array<{ id: number; grade_name: string }>;
}

interface NormalizedRecord {
  commodity_group: string;
  commodity: string;
  msp_price_rs_per_quintal: number | null;
  reported_date: string;
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
}

interface MarketwiseResponse {
  status: string;
  stale: boolean;
  source: string;
  cached: boolean;
  columns: Array<{ key: string; title?: string; columns?: Array<{ key: string; title: string }> }>;
  records: NormalizedRecord[];
  reported_dates: string[];
  fetched_at?: string;
  warning?: string;
  error?: string;
}

interface FilterResponse {
  source: string;
  stale: boolean;
  live_available: boolean;
  cached_state_ids: number[];
  data: AgmarknetFilterData | { data?: AgmarknetFilterData };
  error?: string;
}

interface DashboardFilters {
  state: number;
  district: number[];
  market: number[];
  group: number[];
  commodity: number[];
  variety: number;
  grades: number[];
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const DEFAULT_FILTERS: DashboardFilters = {
  state: 100006,
  district: [],
  market: [100009],
  group: [],
  commodity: [1, 2, 4],
  variety: 100021,
  grades: [],
};

const indiaDate = (offsetDays = 0) => {
  const date = new Date(Date.now() - offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const formatNumber = (value: number | null) =>
  value === null || value === undefined
    ? '-'
    : value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function MandiBhaav() {
  const [draftFilters, setDraftFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [draftDate, setDraftDate] = useState(indiaDate());
  const [appliedDate, setAppliedDate] = useState(indiaDate());
  const [filterData, setFilterData] = useState<AgmarknetFilterData | null>(null);
  const [liveAvailable, setLiveAvailable] = useState(true);
  const [cachedStateIds, setCachedStateIds] = useState<number[]>([100006]);
  const [tableData, setTableData] = useState<MarketwiseResponse>({
    status: 'idle',
    stale: false,
    source: '',
    cached: false,
    columns: [],
    records: [],
    reported_dates: [],
  });
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20;

  const loadFilters = async () => {
    setFiltersLoading(true);
    try {
      const response = await fetch(`${API_URL}/agmarknet/filters`);
      const result = await response.json() as FilterResponse;
      if (!response.ok) throw new Error(result.error || 'Unable to load Agmarknet filters');
      setFilterData(result.data?.data || result.data || {});
      setLiveAvailable(result.live_available !== false);
      setCachedStateIds(result.cached_state_ids?.length ? result.cached_state_ids : [100006]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load Agmarknet filters');
    } finally {
      setFiltersLoading(false);
    }
  };

  const loadMarketData = async (filters: DashboardFilters, date: string, force = false) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/agmarknet/marketwise-price-arrival`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboard: 'marketwise_price_arrival',
          date,
          ...filters,
          limit: 150,
          force,
          format: 'json',
        }),
      });
      const result = await response.json() as MarketwiseResponse;
      if (!response.ok || result.status !== 'success') {
        throw new Error(result.error || 'Unable to load Agmarknet data');
      }
      setTableData(result);
      setCurrentPage(1);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load Agmarknet data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFilters();
    void loadMarketData(DEFAULT_FILTERS, indiaDate());
  }, []);

  const states = filterData?.state_data || [];
  const stateIsAvailable = liveAvailable || cachedStateIds.includes(draftFilters.state);
  const districts = (filterData?.district_data || []).filter((district) =>
    draftFilters.state !== 100006 && district.state_id === draftFilters.state);
  const markets = (filterData?.market_data || []).filter((market) =>
    market.id === 100009
    || ((!market.state_id || draftFilters.state === 100006 || market.state_id === draftFilters.state)
      && (!market.district_id || !draftFilters.district.length || market.district_id === draftFilters.district[0])));
  const groups = filterData?.cmdt_group_data || [];
  const legacyGroups = filterData?.group_data || [];
  const commodities = (filterData?.cmdt_data || []).filter((commodity) =>
    commodity.cmdt_id !== 100001
    && (!draftFilters.group.length || commodity.cmdt_group_id === draftFilters.group[0]));
  const grades = filterData?.grade_data || [];

  const priceTitles = tableData.columns.find((column) => column.key === 'price_group')?.columns?.map((column) => column.title)
    || [
      tableData.records[0]?.price.as_on.title || 'As on',
      tableData.records[0]?.price.one_day_ago.title || '1 day ago',
      tableData.records[0]?.price.two_day_ago.title || '2 days ago',
    ];
  const arrivalTitles = tableData.columns.find((column) => column.key === 'arrival_group')?.columns?.map((column) => column.title)
    || [
      tableData.records[0]?.arrival_metric_tonnes.as_on.title || 'As on',
      tableData.records[0]?.arrival_metric_tonnes.one_day_ago.title || '1 day ago',
      tableData.records[0]?.arrival_metric_tonnes.two_day_ago.title || '2 days ago',
    ];

  const totalPages = Math.max(1, Math.ceil(tableData.records.length / recordsPerPage));
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * recordsPerPage;
    return tableData.records.slice(start, start + recordsPerPage);
  }, [currentPage, tableData.records]);

  const stateName = states.find((state) => state.state_id === appliedFilters.state)?.state_name || 'All States';
  const latestDate = tableData.reported_dates[0] || priceTitles[0] || 'Unknown';

  const applyFilters = () => {
    if (!stateIsAvailable) return;
    setAppliedFilters(draftFilters);
    setAppliedDate(draftDate);
    void loadMarketData(draftFilters, draftDate);
  };

  const resetFilters = () => {
    const date = indiaDate();
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setDraftDate(date);
    setAppliedDate(date);
    void loadMarketData(DEFAULT_FILTERS, date);
  };

  const downloadCsv = () => {
    if (!tableData.records.length) return;
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      [
        'Commodity Group', 'Commodity', 'MSP (Rs./Quintal)',
        ...priceTitles.map((title) => `Price ${title}`),
        ...arrivalTitles.map((title) => `Arrival ${title}`),
      ].map(escape).join(','),
      ...tableData.records.map((record) => [
        record.commodity_group,
        record.commodity,
        record.msp_price_rs_per_quintal,
        record.price.as_on.value,
        record.price.one_day_ago.value,
        record.price.two_day_ago.value,
        record.arrival_metric_tonnes.as_on.value,
        record.arrival_metric_tonnes.one_day_ago.value,
        record.arrival_metric_tonnes.two_day_ago.value,
      ].map(escape).join(',')),
    ];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }));
    link.download = `agmarknet_data_${appliedDate}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const pageNumbers = Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
    if (totalPages <= 5 || currentPage <= 3) return index + 1;
    if (currentPage >= totalPages - 2) return totalPages - 4 + index;
    return currentPage - 2 + index;
  });

  useEffect(() => {
    if (!filtersLoading && !liveAvailable && !cachedStateIds.includes(draftFilters.state)) {
      setDraftFilters(DEFAULT_FILTERS);
    }
  }, [cachedStateIds, draftFilters.state, filtersLoading, liveAvailable]);

  return (
    <section data-testid="agmarknet-dashboard" className="rounded-xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 md:p-7">
      <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800">Market Wise Price & Arrival</h1>
          <p className="mt-1 text-sm font-medium text-blue-600">(MSP Commodities & Tomato, Onion, Potato)</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button type="button" onClick={downloadCsv} disabled={!tableData.records.length}
            className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Download className="h-4 w-4" /> Download
          </button>
        </div>
      </header>

      {filtersLoading ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-4 py-10 text-center text-slate-500">
          Loading Agmarknet filters...
        </div>
      ) : (
        <>
          <div className="grid gap-3 rounded border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <LabeledSelect testId="agmarknet-date" label="Date" value={draftDate} onChange={setDraftDate}>
              <option value={indiaDate()}>Today</option>
              <option value={indiaDate(1)}>Yesterday</option>
              <option value={indiaDate(2)}>2 Days Ago</option>
            </LabeledSelect>
            <LabeledSelect testId="agmarknet-state" label="State" value={draftFilters.state}
              onChange={(value) => setDraftFilters({ ...draftFilters, state: Number(value), district: [], market: [100009] })}>
              {states.map((state) => {
                const available = liveAvailable || cachedStateIds.includes(state.state_id);
                return (
                  <option key={state.state_id} value={state.state_id} disabled={!available}>
                    {state.state_name}{available ? '' : ' (available after next live sync)'}
                  </option>
                );
              })}
            </LabeledSelect>
            <LabeledSelect testId="agmarknet-district" label="District" value={draftFilters.district[0] || ''} disabled={draftFilters.state === 100006}
              onChange={(value) => setDraftFilters({ ...draftFilters, district: value ? [Number(value)] : [], market: [100009] })}>
              <option value="">All Districts</option>
              {districts.filter((district) => (district.id ?? district.district_id) !== 100007).map((district) => (
                <option key={district.id ?? district.district_id} value={district.id ?? district.district_id}>{district.district_name}</option>
              ))}
            </LabeledSelect>
            <LabeledSelect testId="agmarknet-market" label="Market" value={draftFilters.market[0] || 100009}
              onChange={(value) => setDraftFilters({ ...draftFilters, market: [Number(value)] })}>
              {markets.map((market) => <option key={market.id} value={market.id}>{market.mkt_name}</option>)}
            </LabeledSelect>
            <LabeledSelect testId="agmarknet-group" label="Commodity Group" value={draftFilters.group[0] || ''}
              onChange={(value) => setDraftFilters({ ...draftFilters, group: value ? [Number(value)] : [] })}>
              <option value="">All Commodity Groups</option>
              {groups.filter((group) => group.id !== 100000).map((group) => (
                <option key={group.id} value={group.id}>{group.cmdt_grp_name}</option>
              ))}
              {!groups.length && legacyGroups.map((group) => (
                <option key={group.group_id} value={group.group_id}>{group.group_name}</option>
              ))}
            </LabeledSelect>
            <LabeledSelect testId="agmarknet-commodity" label="Commodity" value={draftFilters.commodity.join(',')}
              onChange={(value) => setDraftFilters({ ...draftFilters, commodity: value.split(',').map(Number) })}>
              <option value="1,2,4">Paddy, Maize & Wheat</option>
              <option value="100001">All Commodities</option>
              {commodities.map((commodity) => (
                <option key={commodity.cmdt_id} value={commodity.cmdt_id}>{commodity.cmdt_name}</option>
              ))}
            </LabeledSelect>
            <LabeledSelect testId="agmarknet-variety" label="Variety" value={draftFilters.variety} disabled onChange={() => undefined}>
              <option value={100021}>All Varieties</option>
            </LabeledSelect>
            <LabeledSelect testId="agmarknet-grade" label="Grade" value={draftFilters.grades[0] || ''} onChange={(value) =>
              setDraftFilters({ ...draftFilters, grades: value ? [Number(value)] : [] })}>
              <option value="">All Grades</option>
              {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.grade_name}</option>)}
            </LabeledSelect>
          </div>

          <div className="mt-4 flex gap-2">
            <button type="button" onClick={applyFilters} disabled={!stateIsAvailable}
              className="rounded bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              Go
            </button>
            <button type="button" onClick={resetFilters}
              className="rounded bg-slate-500 px-6 py-2 text-sm font-semibold text-white hover:bg-slate-600">
              Reset
            </button>
            <button type="button" onClick={() => void loadMarketData(appliedFilters, appliedDate, true)}
              className="ml-auto inline-flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          {!liveAvailable && (
            <div className="mt-4 rounded border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Agmarknet live refresh is temporarily unavailable. States with a saved direct Agmarknet result remain selectable;
              other states will unlock automatically after the next successful 6:30 AM IST sync.
            </div>
          )}
        </>
      )}

      {error && (
        <div className="mt-5 flex gap-3 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Live refresh is temporarily unavailable</p>
            <p className="mt-1">{error}</p>
            {tableData.records.length > 0 && <p className="mt-1">The last successful Agmarknet result remains visible below.</p>}
          </div>
        </div>
      )}

      <main className="mt-6">
        {loading && !tableData.records.length ? (
          <div className="py-16 text-center font-medium text-emerald-700">Loading Agmarknet data...</div>
        ) : tableData.records.length ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <span><strong>{stateName}</strong> | Data Freeze Up to {latestDate} | Showing {tableData.records.length} records</span>
              <span className="font-medium text-emerald-700">
                {tableData.source === 'agmarknet-live' ? 'Live Agmarknet' : 'Agmarknet cache'}
                {tableData.stale ? ' (stale)' : ''}
              </span>
            </div>

            <div className="overflow-x-auto rounded border border-slate-300">
              <table className="w-full min-w-[1050px] border-collapse text-sm">
                <thead className="bg-slate-100 text-slate-800">
                  <tr>
                    <th rowSpan={2} className="border-b border-r border-slate-300 px-4 py-3 text-left">Commodity Group</th>
                    <th rowSpan={2} className="border-b border-r border-slate-300 px-4 py-3 text-left">Commodity</th>
                    <th rowSpan={2} className="border-b border-r border-slate-300 px-4 py-3 text-center">MSP (Rs./Quintal) 2026-27</th>
                    <th colSpan={3} className="border-b border-r border-slate-300 px-4 py-3 text-center">Price (Rs./Quintal)</th>
                    <th colSpan={3} className="border-b border-slate-300 px-4 py-3 text-center">Arrival (Metric Tonnes)</th>
                  </tr>
                  <tr>
                    {priceTitles.map((title, index) => (
                      <th key={`price-${index}`} className="border-b border-r border-slate-300 px-4 py-2 text-center text-xs">{title}</th>
                    ))}
                    {arrivalTitles.map((title, index) => (
                      <th key={`arrival-${index}`} className="border-b border-r border-slate-300 px-4 py-2 text-center text-xs">{title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((record, index) => (
                    <tr key={`${record.commodity}-${index}`} className="hover:bg-slate-50">
                      <td className="border-b border-r border-slate-200 px-4 py-3">{record.commodity_group}</td>
                      <td className="border-b border-r border-slate-200 px-4 py-3 font-medium">{record.commodity}</td>
                      <td className="border-b border-r border-slate-200 px-4 py-3 text-right">{formatNumber(record.msp_price_rs_per_quintal)}</td>
                      <td className="border-b border-r border-slate-200 px-4 py-3 text-right">{formatNumber(record.price.as_on.value)}</td>
                      <td className="border-b border-r border-slate-200 px-4 py-3 text-right">{formatNumber(record.price.one_day_ago.value)}</td>
                      <td className="border-b border-r border-slate-200 px-4 py-3 text-right">{formatNumber(record.price.two_day_ago.value)}</td>
                      <td className="border-b border-r border-slate-200 px-4 py-3 text-right">{formatNumber(record.arrival_metric_tonnes.as_on.value)}</td>
                      <td className="border-b border-r border-slate-200 px-4 py-3 text-right">{formatNumber(record.arrival_metric_tonnes.one_day_ago.value)}</td>
                      <td className="border-b border-slate-200 px-4 py-3 text-right">{formatNumber(record.arrival_metric_tonnes.two_day_ago.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <div className="flex gap-1">
                  <PageButton disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Previous</PageButton>
                  {pageNumbers.map((page) => (
                    <PageButton key={page} active={page === currentPage} onClick={() => setCurrentPage(page)}>{page}</PageButton>
                  ))}
                  <PageButton disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Next</PageButton>
                </div>
                <p className="text-sm text-slate-500">
                  Page {currentPage} of {totalPages} (Showing {paginatedRecords.length} of {tableData.records.length} records)
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded border border-slate-200 py-16 text-center text-slate-500">
            <TrendingUp className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            No records found for selected criteria.
          </div>
        )}
      </main>
    </section>
  );
}

function LabeledSelect({
  label,
  testId,
  value,
  disabled,
  onChange,
  children,
}: {
  label: string;
  testId: string;
  value: string | number;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label htmlFor={testId} className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {label}
      <select id={testId} data-testid={testId} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full min-w-0 rounded border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium normal-case text-slate-800 disabled:bg-slate-100 disabled:text-slate-400">
        {children}
      </select>
    </label>
  );
}

function PageButton({
  children,
  active,
  disabled,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      className={`rounded px-3 py-2 text-sm font-medium ${
        active ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-50'
      } disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}>
      {children}
    </button>
  );
}
