import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, Calendar, BarChart3, Activity } from 'lucide-react';
import { buildAnalyticsFilterParams, type AnalyticsDateFilters } from '../../../lib/analyticsExport';

interface TimeBasedData {
  date: string;
  salesOrders: number;
  salesAmount: number;
  salesWeight: number;
  purchaseOrders: number;
  purchaseAmount: number;
  purchaseWeight: number;
  totalOrders: number;
  totalAmount: number;
}

interface Props {
  period: string;
  groupBy: string;
  orderType: 'sales' | 'purchase';
  filters: AnalyticsDateFilters;
}

export default function TimeBasedCharts({ period, groupBy, orderType, filters }: Props) {
  const [data, setData] = useState<TimeBasedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<'trends' | 'amount' | 'weight'>('trends');
  const showSales = orderType === 'sales';
  const showPurchase = orderType === 'purchase';
  const datasetLabel = showSales ? 'Sales' : 'Purchase';

  useEffect(() => {
    fetchData();
  }, [filters, groupBy, orderType, period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      const query = new URLSearchParams(
        Object.entries(buildAnalyticsFilterParams(filters, { orderType, groupBy, period }))
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => [key, String(value)])
      );

      const response = await fetch(`${apiUrl}/analytics/time-based?${query.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setData(result.trends || []);
      }
    } catch (error) {
      console.error('Failed to fetch time-based analytics:', error);
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

  const formatDate = (dateStr: string) => {
    if (groupBy === 'month') {
      const [year, month] = dateStr.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[parseInt(month) - 1]} ${year.slice(2)}`;
    }
    if (groupBy === 'week') {
      return dateStr;
    }
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-100 rounded"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Chart Type Selector */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveChart('trends')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeChart === 'trends'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Order Trends
        </button>
        <button
          onClick={() => setActiveChart('amount')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeChart === 'amount'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          Transaction Amount
        </button>
        <button
          onClick={() => setActiveChart('weight')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeChart === 'weight'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Weight Analysis
        </button>
      </div>

      {/* Charts */}
      {activeChart === 'trends' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Daily/Weekly/Monthly Order Trends
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                stroke="#888"
              />
              <YAxis tick={{ fontSize: 12 }} stroke="#888" />
              <Tooltip
                formatter={(value: number, name: string) => [value, name]}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
            <Legend />
              {showSales && (
                <Line
                  type="monotone"
                  dataKey="salesOrders"
                  name="Sales Orders"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
              {showPurchase && (
                <Line
                  type="monotone"
                  dataKey="purchaseOrders"
                  name="Purchase Orders"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeChart === 'amount' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            Transaction Amount Over Time
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="purchaseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                stroke="#888"
              />
              <YAxis 
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
                stroke="#888"
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value)]}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              {showSales && (
                <Area
                  type="monotone"
                  dataKey="salesAmount"
                  name="Sales Amount"
                  stroke="#10b981"
                  fill="url(#salesGradient)"
                  strokeWidth={2}
                />
              )}
              {showPurchase && (
                <Area
                  type="monotone"
                  dataKey="purchaseAmount"
                  name="Purchase Amount"
                  stroke="#6366f1"
                  fill="url(#purchaseGradient)"
                  strokeWidth={2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeChart === 'weight' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-600" />
            {datasetLabel} Weight Movement
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                stroke="#888"
              />
              <YAxis 
                tickFormatter={(value) => `${Number(value || 0).toFixed(0)} MT`}
                tick={{ fontSize: 12 }}
                stroke="#888"
              />
              <Tooltip
                formatter={(value: number) => [`${Number(value || 0).toFixed(2)} MT`]}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              {showSales && (
                <Bar 
                  dataKey="salesWeight" 
                  name="Sales Weight (MT)" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]}
                />
              )}
              {showPurchase && (
                <Bar 
                  dataKey="purchaseWeight" 
                  name="Purchase Weight (MT)" 
                  fill="#6366f1" 
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${showSales ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gradient-to-br from-indigo-500 to-indigo-600'} rounded-xl p-4 text-white`}>
          <p className="text-sm opacity-90">Total {datasetLabel} Orders</p>
          <p className="text-2xl font-bold mt-1">
            {data.reduce((sum, d) => sum + (showSales ? d.salesOrders : d.purchaseOrders), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-90">Total {datasetLabel} Amount</p>
          <p className="text-2xl font-bold mt-1">
            {formatCurrency(data.reduce((sum, d) => sum + (showSales ? d.salesAmount : d.purchaseAmount), 0))}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-90">Total {datasetLabel} Weight</p>
          <p className="text-2xl font-bold mt-1">
            {data.reduce((sum, d) => sum + (showSales ? d.salesWeight : d.purchaseWeight), 0).toFixed(2)} MT
          </p>
        </div>
      </div>
    </div>
  );
}
