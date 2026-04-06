import * as XLSX from 'xlsx';

export type AnalyticsOrderType = 'sales' | 'purchase';
export type AnalyticsFilterMode = 'year' | 'month' | 'week' | 'date-range';
export type AnalyticsDateFilters = {
  filterMode: AnalyticsFilterMode;
  year: number;
  month: number;
  week: number;
  startDate: string;
  endDate: string;
};

export type AnalyticsReportType =
  | 'order-summary'
  | 'daily-transaction'
  | 'customer-ledger'
  | 'commodity-price'
  | 'deduction'
  | 'warehouse-stock'
  | 'vehicle'
  | 'quality'
  | 'state-summary'
  | 'monthly-pl';

export const analyticsReportTypes: { key: AnalyticsReportType; label: string }[] = [
  { key: 'order-summary', label: 'Order Summary' },
  { key: 'daily-transaction', label: 'Daily Transaction' },
  { key: 'customer-ledger', label: 'Customer Ledger' },
  { key: 'commodity-price', label: 'Commodity Price' },
  { key: 'deduction', label: 'Deduction Report' },
  { key: 'warehouse-stock', label: 'Warehouse Stock' },
  { key: 'vehicle', label: 'Vehicle Report' },
  { key: 'quality', label: 'Quality Report' },
  { key: 'state-summary', label: 'State Summary' },
  { key: 'monthly-pl', label: 'Monthly P&L' }
];

const ANALYTICS_START_YEAR = 2020;
const ANALYTICS_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const monthFormatter = new Intl.DateTimeFormat('en', { month: 'long' });

export function getAnalyticsYearOptions() {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: currentYear - ANALYTICS_START_YEAR + 1 }, (_, index) => ANALYTICS_START_YEAR + index);
}

export function getAnalyticsMonthOptions() {
  return Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: monthFormatter.format(new Date(Date.UTC(2025, index, 1)))
  }));
}

export function getAnalyticsWeekOptions() {
  return Array.from({ length: 53 }, (_, index) => ({
    value: index + 1,
    label: `Week ${index + 1}`
  }));
}

export function buildAnalyticsFilterParams(
  filters: AnalyticsDateFilters,
  extraParams: Record<string, string | number | null | undefined> = {}
) {
  const params: Record<string, string | number | null | undefined> = {
    period: 'all',
    filterMode: filters.filterMode,
    year: filters.year
  };

  if (filters.filterMode === 'month') {
    params.month = filters.month;
  }

  if (filters.filterMode === 'week') {
    params.week = filters.week;
  }

  if (filters.filterMode === 'date-range') {
    params.startDate = filters.startDate;
    params.endDate = filters.endDate;
  }

  return {
    ...params,
    ...extraParams
  };
}

export function getAnalyticsFilterSummary(filters: AnalyticsDateFilters) {
  switch (filters.filterMode) {
    case 'month': {
      const monthLabel = getAnalyticsMonthOptions().find((item) => item.value === filters.month)?.label || filters.month;
      return `Month: ${monthLabel} ${filters.year}`;
    }
    case 'week':
      return `Week: ${filters.week}, ${filters.year}`;
    case 'date-range':
      return `Date Range: ${filters.startDate || 'N/A'} to ${filters.endDate || 'N/A'}`;
    case 'year':
    default:
      return `Year: ${filters.year}`;
  }
}

export async function fetchAnalyticsJson(
  endpoint: string,
  token: string | null,
  params: Record<string, string | number | null | undefined>
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  const response = await fetch(`${ANALYTICS_API_URL}${endpoint}${query ? `?${query}` : ''}`, {
    headers: {
      Authorization: `Bearer ${token || ''}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch analytics data' }));
    throw new Error(error.error || error.message || 'Failed to fetch analytics data');
  }

  return response.json();
}

function safeSheetName(name: string) {
  return name.replace(/[\\/?*:[\]]/g, ' ').trim().slice(0, 31) || 'Sheet';
}

function downloadWorkbook(
  sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>,
  filename: string
) {
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const rows = sheet.rows.length > 0 ? sheet.rows : [{ Message: 'No data available' }];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName(sheet.name));
  });

  const blob = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportActiveAnalyticsReport(options: {
  reportType: AnalyticsReportType;
  reportLabel: string;
  orderType: AnalyticsOrderType;
  filters: AnalyticsDateFilters;
}) {
  const token = localStorage.getItem('auth_token');
  const report = await fetchAnalyticsJson(`/analytics/reports/${options.reportType}`, token, buildAnalyticsFilterParams(options.filters, {
    orderType: options.orderType,
    page: 1,
    limit: 1000000
  }));

  downloadWorkbook(
    [
      {
        name: options.reportLabel,
        rows: Array.isArray(report.data) ? report.data : []
      }
    ],
    `${options.reportType}-${options.orderType}-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

export async function exportAnalyticsWorkbook(options: {
  orderType: AnalyticsOrderType;
  compareYear: number;
  groupBy: string;
  filters: AnalyticsDateFilters;
}) {
  const token = localStorage.getItem('auth_token');
  const params = buildAnalyticsFilterParams(options.filters, {
    orderType: options.orderType
  });

  const [
    timeBased,
    commodity,
    customer,
    comparison,
    ...reports
  ] = await Promise.all([
    fetchAnalyticsJson('/analytics/time-based', token, { ...params, groupBy: options.groupBy }),
    fetchAnalyticsJson('/analytics/commodity', token, params),
    fetchAnalyticsJson('/analytics/customer', token, buildAnalyticsFilterParams(options.filters, { type: options.orderType })),
    fetchAnalyticsJson('/analytics/comparison', token, { ...params, compareYear: options.compareYear }),
    ...analyticsReportTypes.map((reportType) =>
      fetchAnalyticsJson(`/analytics/reports/${reportType.key}`, token, buildAnalyticsFilterParams(options.filters, {
        orderType: options.orderType,
        page: 1,
        limit: 1000000
      }))
    )
  ]);

  const datasetLabel = options.orderType === 'sales' ? 'Sales' : 'Purchase';
  const summarySource = options.orderType === 'sales' ? comparison.sales : comparison.purchase;
  const commodityRows = (
    options.orderType === 'sales'
      ? commodity.salesByCommodity
      : commodity.purchaseByCommodity
  ) || [];
  const stateRows = (
    options.orderType === 'sales'
      ? comparison.salesByState
      : comparison.purchaseByState
  ) || [];
  const warehouseRows = (comparison.warehouseComparison || []).map((row: any) => ({
    Warehouse: row.warehouse,
    Orders: options.orderType === 'sales' ? row.salesOrders : row.purchaseOrders,
    Amount: options.orderType === 'sales' ? row.salesAmount : row.purchaseAmount
  }));
  const priceTrendRows = Object.entries(commodity.priceTrends || {}).flatMap(([commodityName, rows]: [string, any]) =>
    (Array.isArray(rows) ? rows : []).map((row: any) => ({
      Commodity: commodityName,
      Date: row.date,
      RatePerMT: row.rate
    }))
  );
  const yearComparisonRows = (comparison.yearComparison || []).map((row: any) => ({
    Year: row.year,
    Orders: options.orderType === 'sales' ? row.sales.totalOrders : row.purchase.totalOrders,
    Amount: options.orderType === 'sales' ? row.sales.totalAmount : row.purchase.totalAmount,
    WeightMT: options.orderType === 'sales' ? row.sales.totalWeight : row.purchase.totalWeight
  }));

  const sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }> = [
    {
      name: 'Dashboard Summary',
      rows: [
        { Filter: 'Dataset', Value: datasetLabel },
        { Filter: 'Primary Filter', Value: getAnalyticsFilterSummary(options.filters) },
        { Filter: 'Compare Year', Value: options.compareYear },
        { Metric: 'Total Orders', Value: summarySource?.totalOrders || 0 },
        { Metric: 'Total Amount', Value: summarySource?.totalAmount || 0 },
        { Metric: 'Total Weight (MT)', Value: summarySource?.totalWeight || 0 },
        { Metric: 'Total Deductions', Value: summarySource?.totalDeductions || 0 },
        { Metric: 'Average Rate/MT', Value: summarySource?.avgRate || 0 }
      ]
    },
    {
      name: 'Time Analysis',
      rows: (timeBased.trends || []).map((row: any) => ({
        Date: row.date,
        Orders: options.orderType === 'sales' ? row.salesOrders : row.purchaseOrders,
        Amount: options.orderType === 'sales' ? row.salesAmount : row.purchaseAmount,
        WeightMT: options.orderType === 'sales' ? row.salesWeight : row.purchaseWeight
      }))
    },
    {
      name: 'Commodity Analysis',
      rows: commodityRows.map((row: any) => ({
        Commodity: row.commodity,
        Orders: row.orders,
        Amount: row.amount,
        WeightMT: row.weight,
        AvgRate: row.avgRate,
        MinRate: row.minRate,
        MaxRate: row.maxRate
      }))
    },
    {
      name: 'Variety Breakdown',
      rows: (commodity.varietyBreakdown || []).map((row: any) => ({
        Commodity: row.commodity,
        Variety: row.variety,
        Orders: row.orders,
        Amount: row.amount,
        WeightMT: row.weight
      }))
    },
    {
      name: 'Commodity Trends',
      rows: priceTrendRows
    },
    {
      name: 'Trade Names',
      rows: (customer.topCustomers || []).map((row: any) => ({
        TradeName: row.customerName,
        Email: row.customerEmail,
        TotalOrders: row.totalOrders,
        TotalAmount: row.totalAmount,
        TotalWeightMT: row.totalWeight,
        AvgOrderValue: row.avgOrderValue,
        FirstOrder: row.firstOrder,
        LastOrder: row.lastOrder
      }))
    },
    {
      name: 'Order Frequency',
      rows: (customer.orderFrequency || []).map((row: any) => ({
        Range: row.range,
        Count: row.count
      }))
    },
    {
      name: 'Revenue Distribution',
      rows: (customer.customerRevenue || []).map((row: any) => ({
        TradeName: row.customerName,
        Amount: row.amount
      }))
    },
    {
      name: 'Customer Types',
      rows: [
        { Type: 'New', Count: customer.customerTypes?.new || 0 },
        { Type: 'Returning', Count: customer.customerTypes?.returning || 0 },
        { Type: 'One-time', Count: customer.customerTypes?.oneTime || 0 },
        { Type: 'Total', Count: customer.customerTypes?.total || 0 }
      ]
    },
    {
      name: 'Year Comparison',
      rows: yearComparisonRows
    },
    {
      name: 'Warehouse Analysis',
      rows: warehouseRows
    },
    {
      name: 'State Analysis',
      rows: stateRows.map((row: any) => ({
        State: row.state,
        Orders: row.orders,
        Amount: row.amount,
        WeightMT: row.weight
      }))
    }
  ];

  analyticsReportTypes.forEach((reportType, index) => {
    sheets.push({
      name: reportType.label,
      rows: Array.isArray(reports[index]?.data) ? reports[index].data : []
    });
  });

  downloadWorkbook(
    sheets,
    `analytics-dashboard-${options.orderType}-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}
