import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Users, TrendingUp, UserPlus, RefreshCw } from 'lucide-react';
import { buildAnalyticsFilterParams, type AnalyticsDateFilters } from '../../../lib/analyticsExport';

interface TopCustomer {
  customerId: string;
  customerName: string;
  customerEmail: string;
  totalOrders: number;
  totalAmount: number;
  totalWeight: number;
  avgOrderValue: number;
  firstOrder: string;
  lastOrder: string;
}

interface Props {
  period: string;
  type: 'sales' | 'purchase';
  filters: AnalyticsDateFilters;
}

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#14b8a6', '#f97316'];

export default function CustomerAnalysis({ period, type, filters }: Props) {
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [orderFrequency, setOrderFrequency] = useState<{ range: string; count: number }[]>([]);
  const [customerRevenue, setCustomerRevenue] = useState<{ customerName: string; amount: number }[]>([]);
  const [customerTypes, setCustomerTypes] = useState({ new: 0, returning: 0, oneTime: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'top10' | 'frequency' | 'revenue' | 'types'>('top10');
  const resolvedType = type;

  useEffect(() => {
    fetchData();
  }, [filters, period, type]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      const query = new URLSearchParams(
        Object.entries(buildAnalyticsFilterParams(filters, { type, period }))
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => [key, String(value)])
      );
      const response = await fetch(`${apiUrl}/analytics/customer?${query.toString()}`, { headers });

      if (!response.ok) {
        throw new Error('Failed to fetch customer analytics');
      }

      const result = await response.json();
      if (result) {
        setTopCustomers(result.topCustomers || []);
        setOrderFrequency(result.orderFrequency || []);
        setCustomerRevenue(result.customerRevenue || []);
        setCustomerTypes(result.customerTypes || { new: 0, returning: 0, oneTime: 0, total: 0 });
      } else {
        setTopCustomers([]);
        setOrderFrequency([]);
        setCustomerRevenue([]);
        setCustomerTypes({ new: 0, returning: 0, oneTime: 0, total: 0 });
      }
    } catch (error) {
      console.error('Failed to fetch customer analytics:', error);
      setTopCustomers([]);
      setOrderFrequency([]);
      setCustomerRevenue([]);
      setCustomerTypes({ new: 0, returning: 0, oneTime: 0, total: 0 });
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

  // Prepare customer types donut data
  const customerTypesData = [
    { name: 'New (30 days)', value: customerTypes.new, color: '#10b981' },
    { name: 'Returning', value: customerTypes.returning, color: '#6366f1' },
    { name: 'One-time', value: customerTypes.oneTime, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  // Prepare revenue pie data
  const revenuePieData = customerRevenue.map((c, index) => ({
    name: c.customerName,
    value: c.amount,
    color: COLORS[index % COLORS.length]
  }));

  const hasCustomerData =
    topCustomers.length > 0 ||
    orderFrequency.length > 0 ||
    customerRevenue.length > 0 ||
    customerTypes.total > 0;

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (!hasCustomerData) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-10 text-center text-gray-500">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium text-gray-700">No trade name analytics available</p>
        <p className="text-sm mt-2">Confirmed sales or purchase order data is needed to populate this section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveView('top10')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeView === 'top10'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Top 10 Trade Names
        </button>
        <button
          onClick={() => setActiveView('frequency')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeView === 'frequency'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Order Frequency
        </button>
        <button
          onClick={() => setActiveView('revenue')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeView === 'revenue'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Revenue Distribution
        </button>
        <button
          onClick={() => setActiveView('types')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeView === 'types'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          Customer Types
        </button>
      </div>

      {/* Charts */}
      {activeView === 'top10' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            Top 10 Trade Names by Volume
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topCustomers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                type="number" 
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                type="category" 
                dataKey="customerName" 
                width={150}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'Total Amount') return [formatCurrency(value), name];
                  return [value, name];
                }}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar 
                dataKey="totalAmount" 
                name="Total Amount" 
                fill="#10b981" 
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Top Customers Table */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 font-semibold">Rank</th>
                  <th className="text-left p-3 font-semibold">Trade Name</th>
                  <th className="text-right p-3 font-semibold">Orders</th>
                  <th className="text-right p-3 font-semibold">Total Amount</th>
                  <th className="text-right p-3 font-semibold">Avg Order</th>
                  <th className="text-right p-3 font-semibold">Weight (MT)</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, index) => (
                  <tr key={c.customerId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        #{index + 1}
                      </span>
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{c.customerName}</p>
                      <p className="text-xs text-gray-500">{c.customerEmail}</p>
                    </td>
                    <td className="p-3 text-right font-semibold">{c.totalOrders}</td>
                    <td className="p-3 text-right font-semibold text-green-600">{formatCurrency(c.totalAmount)}</td>
                    <td className="p-3 text-right">{formatCurrency(c.avgOrderValue)}</td>
                    <td className="p-3 text-right">{c.totalWeight.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === 'frequency' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            Trade Name Order Frequency Distribution
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={orderFrequency}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="range" 
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number) => [value, 'Customers']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Bar 
                dataKey="count" 
                name="Number of Customers" 
                fill="#6366f1" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {orderFrequency.map((f, index) => (
              <div key={f.range} className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600">{f.range}</p>
                <p className="text-2xl font-bold mt-1" style={{ color: COLORS[index % COLORS.length] }}>
                  {f.count}
                </p>
                <p className="text-xs text-gray-500">customers</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeView === 'revenue' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Trade Name Revenue (Top 10)
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={revenuePieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {revenuePieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue Details</h3>
            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {customerRevenue.map((c, index) => (
                <div key={c.customerName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{c.customerName}</span>
                  </div>
                  <span className="font-semibold text-green-600">{formatCurrency(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeView === 'types' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-amber-600" />
              New vs Returning Trade Names
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={customerTypesData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {customerTypesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, 'Customers']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Trade Name Statistics</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-6 h-6 text-emerald-600" />
                  <div>
                    <p className="font-medium text-emerald-800">New Customers</p>
                    <p className="text-sm text-emerald-600">Last 30 days</p>
                  </div>
                </div>
                <span className="text-3xl font-bold text-emerald-600">{customerTypes.new}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <RefreshCw className="w-6 h-6 text-indigo-600" />
                  <div>
                    <p className="font-medium text-indigo-800">Returning Customers</p>
                    <p className="text-sm text-indigo-600">More than 1 order</p>
                  </div>
                </div>
                <span className="text-3xl font-bold text-indigo-600">{customerTypes.returning}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-amber-600" />
                  <div>
                    <p className="font-medium text-amber-800">One-time Customers</p>
                    <p className="text-sm text-amber-600">Single order only</p>
                  </div>
                </div>
                <span className="text-3xl font-bold text-amber-600">{customerTypes.oneTime}</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-800">Total Customers</p>
                    <p className="text-sm text-gray-600">All time</p>
                  </div>
                </div>
                <span className="text-3xl font-bold text-gray-700">{customerTypes.total}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
