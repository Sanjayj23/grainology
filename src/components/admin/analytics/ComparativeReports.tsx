import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { GitCompare, Warehouse, MapPin } from 'lucide-react';
import { buildAnalyticsFilterParams, type AnalyticsDateFilters } from '../../../lib/analyticsExport';

interface ComparisonData {
  orderType?: 'all' | 'sales' | 'purchase';
  activeYear?: number | null;
  compareYear?: number | null;
  sales: {
    totalOrders: number;
    totalAmount: number;
    totalWeight: number;
    totalDeductions: number;
    avgRate: number;
  };
  purchase: {
    totalOrders: number;
    totalAmount: number;
    totalWeight: number;
    totalDeductions: number;
    avgRate: number;
  };
  warehouseComparison: Array<{
    warehouse: string;
    salesOrders: number;
    salesAmount: number;
    purchaseOrders: number;
    purchaseAmount: number;
  }>;
  salesByState: Array<{
    state: string;
    orders: number;
    amount: number;
    weight: number;
  }>;
  purchaseByState: Array<{
    state: string;
    orders: number;
    amount: number;
    weight: number;
  }>;
  yearComparison?: Array<{
    year: number;
    sales: {
      totalOrders: number;
      totalAmount: number;
      totalWeight: number;
    };
    purchase: {
      totalOrders: number;
      totalAmount: number;
      totalWeight: number;
    };
    total: {
      totalOrders: number;
      totalAmount: number;
      totalWeight: number;
    };
  }>;
}

interface Props {
  period: string;
  orderType: 'all' | 'sales' | 'purchase';
  filters: AnalyticsDateFilters;
  compareYear?: number | null;
}

export default function ComparativeReports({ period, orderType, filters, compareYear }: Props) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'comparison' | 'warehouse' | 'state'>('comparison');

  useEffect(() => {
    fetchData();
  }, [compareYear, filters, orderType, period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      const query = new URLSearchParams(
        Object.entries(buildAnalyticsFilterParams(filters, { orderType, period, compareYear }))
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => [key, String(value)])
      );

      const response = await fetch(`${apiUrl}/analytics/comparison?${query.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error('Failed to fetch comparison analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
    return `₹${value.toFixed(0)}`;
  };

  // Prepare dual axis chart data
  const comparisonData = data ? [
    { name: 'Orders', sales: data.sales.totalOrders, purchase: data.purchase.totalOrders },
    { name: 'Amount (L)', sales: data.sales.totalAmount / 100000, purchase: data.purchase.totalAmount / 100000 },
    { name: 'Weight (MT)', sales: data.sales.totalWeight, purchase: data.purchase.totalWeight },
    { name: 'Deductions (K)', sales: data.sales.totalDeductions / 1000, purchase: data.purchase.totalDeductions / 1000 }
  ] : [];

  const showSales = orderType === 'all' || orderType === 'sales';
  const showPurchase = orderType === 'all' || orderType === 'purchase';
  const datasetLabel = orderType === 'sales' ? 'Sales' : orderType === 'purchase' ? 'Purchase' : 'Combined';
  const selectedSummary = orderType === 'sales' ? data?.sales : orderType === 'purchase' ? data?.purchase : null;

  // Prepare radar chart data for warehouses
  const radarData = data?.warehouseComparison.slice(0, 6).map(w => ({
    warehouse: w.warehouse.substring(0, 15),
    sales: w.salesAmount / 100000, // Convert to lakhs
    purchase: w.purchaseAmount / 100000
  })) || [];

  // Prepare state comparison data
  const allStates = new Set([
    ...(data?.salesByState.map(s => s.state) || []),
    ...(data?.purchaseByState.map(s => s.state) || [])
  ]);

  const stateComparisonData = Array.from(allStates).slice(0, 10).map(state => {
    const sales = data?.salesByState.find(s => s.state === state) || { orders: 0, amount: 0 };
    const purchase = data?.purchaseByState.find(s => s.state === state) || { orders: 0, amount: 0 };
    return {
      state,
      salesAmount: sales.amount,
      purchaseAmount: purchase.amount
    };
  }).sort((a, b) => (b.salesAmount + b.purchaseAmount) - (a.salesAmount + a.purchaseAmount));

  const yearComparisonData = (data?.yearComparison || []).map((item) => ({
    year: String(item.year),
    salesAmount: item.sales.totalAmount,
    purchaseAmount: item.purchase.totalAmount,
    totalAmount: item.total.totalAmount,
    totalOrders: item.total.totalOrders
  }));

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <p className="text-gray-500 text-center">No comparison data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveView('comparison')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeView === 'comparison'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <GitCompare className="w-4 h-4" />
          {datasetLabel} Comparison
        </button>
        <button
          onClick={() => setActiveView('warehouse')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeView === 'warehouse'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Warehouse className="w-4 h-4" />
          Warehouse Analysis
        </button>
        <button
          onClick={() => setActiveView('state')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeView === 'state'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          State Analysis
        </button>
      </div>

      {/* Summary Cards */}
      <div className={`grid gap-4 ${orderType === 'all' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
        {showSales && (
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
            <p className="text-sm opacity-90">{showSales ? 'Sales Orders' : 'Purchase Orders'}</p>
            <p className="text-2xl font-bold mt-1">{data.sales.totalOrders.toLocaleString()}</p>
            <p className="text-xs opacity-75 mt-1">{formatCurrency(data.sales.totalAmount)}</p>
          </div>
        )}
        {showPurchase && (
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white">
            <p className="text-sm opacity-90">Purchase Orders</p>
            <p className="text-2xl font-bold mt-1">{data.purchase.totalOrders.toLocaleString()}</p>
            <p className="text-xs opacity-75 mt-1">{formatCurrency(data.purchase.totalAmount)}</p>
          </div>
        )}
        {showSales && (
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
            <p className="text-sm opacity-90">Sales Weight</p>
            <p className="text-2xl font-bold mt-1">{data.sales.totalWeight.toFixed(2)} MT</p>
          </div>
        )}
        {showPurchase && (
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
            <p className="text-sm opacity-90">Purchase Weight</p>
            <p className="text-2xl font-bold mt-1">{data.purchase.totalWeight.toFixed(2)} MT</p>
          </div>
        )}
      </div>

      {yearComparisonData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Year-wise Comparison</h3>
              <p className="text-sm text-gray-500">
                Comparing {yearComparisonData.map((item) => item.year).join(' vs ')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={yearComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={formatCurrency} />
                <Tooltip formatter={(value: number) => [formatCurrency(value)]} />
                <Legend />
                {showSales && <Bar dataKey="salesAmount" name="Sales Amount" fill="#10b981" radius={[4, 4, 0, 0]} />}
                {showPurchase && <Bar dataKey="purchaseAmount" name="Purchase Amount" fill="#6366f1" radius={[4, 4, 0, 0]} />}
                {orderType !== 'all' && <Bar dataKey="totalAmount" name="Total Amount" fill={orderType === 'sales' ? '#10b981' : '#6366f1'} radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 font-semibold">Year</th>
                    {showSales && <th className="text-right p-3 font-semibold text-emerald-600">Sales</th>}
                    {showPurchase && <th className="text-right p-3 font-semibold text-indigo-600">Purchase</th>}
                    <th className="text-right p-3 font-semibold">Total Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {yearComparisonData.map((item, index) => (
                    <tr key={item.year} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="p-3 font-medium">{item.year}</td>
                      {showSales && <td className="p-3 text-right text-emerald-600">{formatCurrency(item.salesAmount)}</td>}
                      {showPurchase && <td className="p-3 text-right text-indigo-600">{formatCurrency(item.purchaseAmount)}</td>}
                      <td className="p-3 text-right font-semibold">{item.totalOrders.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {activeView === 'comparison' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <GitCompare className="w-5 h-5 text-blue-600" />
              {orderType === 'all' ? 'Purchase vs Sales Comparison' : `${datasetLabel} Year Comparison`}
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={orderType === 'all' ? comparisonData : yearComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey={orderType === 'all' ? 'name' : 'year'} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                />
                <Legend />
                {orderType === 'all' && showSales && <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[4, 4, 0, 0]} />}
                {orderType === 'all' && showPurchase && <Bar dataKey="purchase" name="Purchase" fill="#6366f1" radius={[4, 4, 0, 0]} />}
                {orderType !== 'all' && (
                  <Bar
                    dataKey="totalAmount"
                    name={`${datasetLabel} Amount`}
                    fill={orderType === 'sales' ? '#10b981' : '#6366f1'}
                    radius={[4, 4, 0, 0]}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {orderType === 'all' ? 'Detailed Comparison' : `${datasetLabel} Summary`}
            </h3>
            <div className="space-y-4">
              {orderType === 'all' ? (
                <>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <p className="text-xs text-emerald-600 font-medium">SALES</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 font-medium">METRIC</p>
                    </div>
                    <div className="bg-indigo-50 rounded-lg p-3">
                      <p className="text-xs text-indigo-600 font-medium">PURCHASE</p>
                    </div>
                  </div>

                  {[
                    { label: 'Total Orders', sales: data.sales.totalOrders, purchase: data.purchase.totalOrders, format: 'number' },
                    { label: 'Total Amount', sales: data.sales.totalAmount, purchase: data.purchase.totalAmount, format: 'currency' },
                    { label: 'Total Weight (MT)', sales: data.sales.totalWeight, purchase: data.purchase.totalWeight, format: 'weight' },
                    { label: 'Total Deductions', sales: data.sales.totalDeductions, purchase: data.purchase.totalDeductions, format: 'currency' },
                    { label: 'Avg Rate/MT', sales: data.sales.avgRate, purchase: data.purchase.avgRate, format: 'currency' }
                  ].map((row, index) => (
                    <div key={row.label} className={`grid grid-cols-3 gap-4 text-center py-3 ${index % 2 === 0 ? 'bg-gray-50' : ''} rounded`}>
                      <div className="font-semibold text-emerald-600">
                        {row.format === 'currency' ? formatCurrency(row.sales) :
                         row.format === 'weight' ? row.sales.toFixed(2) :
                         row.sales.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">{row.label}</div>
                      <div className="font-semibold text-indigo-600">
                        {row.format === 'currency' ? formatCurrency(row.purchase) :
                         row.format === 'weight' ? row.purchase.toFixed(2) :
                         row.purchase.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                [
                  { label: 'Total Orders', value: selectedSummary?.totalOrders || 0, format: 'number' },
                  { label: 'Total Amount', value: selectedSummary?.totalAmount || 0, format: 'currency' },
                  { label: 'Total Weight (MT)', value: selectedSummary?.totalWeight || 0, format: 'weight' },
                  { label: 'Total Deductions', value: selectedSummary?.totalDeductions || 0, format: 'currency' },
                  { label: 'Avg Rate/MT', value: selectedSummary?.avgRate || 0, format: 'currency' }
                ].map((row, index) => (
                  <div key={row.label} className={`flex items-center justify-between py-3 px-4 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} rounded`}>
                    <p className="text-sm text-gray-600">{row.label}</p>
                    <p className={`font-semibold ${orderType === 'sales' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      {row.format === 'currency' ? formatCurrency(row.value) :
                       row.format === 'weight' ? Number(row.value).toFixed(2) :
                       Number(row.value).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeView === 'warehouse' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Warehouse className="w-5 h-5 text-purple-600" />
              {orderType === 'all' ? 'Warehouse Comparison (Radar)' : `${datasetLabel} Warehouse Analysis`}
            </h3>
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="warehouse" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis tick={{ fontSize: 10 }} />
                {showSales && (
                  <Radar
                    name="Sales (₹L)"
                    dataKey="sales"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.5}
                  />
                )}
                {showPurchase && (
                  <Radar
                    name="Purchase (₹L)"
                    dataKey="purchase"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.5}
                  />
                )}
                <Legend />
                <Tooltip formatter={(value: number) => [`₹${value.toFixed(2)}L`]} />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Warehouse Details</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {data.warehouseComparison.map((w, index) => (
                <div key={w.warehouse} className="bg-gray-50 rounded-lg p-4">
                  <p className="font-medium text-gray-800 mb-2">{w.warehouse}</p>
                  {orderType === 'all' ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Sales</p>
                        <p className="font-semibold text-emerald-600">{w.salesOrders} orders</p>
                        <p className="text-emerald-600">{formatCurrency(w.salesAmount)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Purchase</p>
                        <p className="font-semibold text-indigo-600">{w.purchaseOrders} orders</p>
                        <p className="text-indigo-600">{formatCurrency(w.purchaseAmount)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm">
                      <p className="text-gray-500">{datasetLabel}</p>
                      <p className={`font-semibold ${orderType === 'sales' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                        {orderType === 'sales' ? w.salesOrders : w.purchaseOrders} orders
                      </p>
                      <p className={orderType === 'sales' ? 'text-emerald-600' : 'text-indigo-600'}>
                        {formatCurrency(orderType === 'sales' ? w.salesAmount : w.purchaseAmount)}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeView === 'state' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            {orderType === 'all' ? 'State-wise Analysis (Stacked Area)' : `${datasetLabel} State Analysis`}
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={stateComparisonData}>
              <defs>
                <linearGradient id="salesGradientState" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="purchaseGradientState" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="state" 
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value)]}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              {showSales && (
                <Area
                  type="monotone"
                  dataKey="salesAmount"
                  name="Sales Amount"
                  stroke="#10b981"
                  fill="url(#salesGradientState)"
                  stackId="1"
                />
              )}
              {showPurchase && (
                <Area
                  type="monotone"
                  dataKey="purchaseAmount"
                  name="Purchase Amount"
                  stroke="#6366f1"
                  fill="url(#purchaseGradientState)"
                  stackId="2"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>

          {/* State Summary Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 font-semibold">State</th>
                  {showSales && <th className="text-right p-3 font-semibold text-emerald-600">Sales Amount</th>}
                  {showPurchase && <th className="text-right p-3 font-semibold text-indigo-600">Purchase Amount</th>}
                  <th className="text-right p-3 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {stateComparisonData.map((s, index) => (
                  <tr key={s.state} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-medium">{s.state}</td>
                    {showSales && <td className="p-3 text-right text-emerald-600">{formatCurrency(s.salesAmount)}</td>}
                    {showPurchase && <td className="p-3 text-right text-indigo-600">{formatCurrency(s.purchaseAmount)}</td>}
                    <td className="p-3 text-right font-semibold">{formatCurrency(s.salesAmount + s.purchaseAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
