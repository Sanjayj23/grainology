import { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Package, TrendingUp, Layers } from 'lucide-react';
import { buildAnalyticsFilterParams, type AnalyticsDateFilters } from '../../../lib/analyticsExport';

interface CommodityData {
  commodity: string;
  orders: number;
  amount: number;
  weight: number;
  avgRate: number;
  minRate: number;
  maxRate: number;
}

interface VarietyData {
  commodity: string;
  variety: string;
  orders: number;
  amount: number;
  weight: number;
}

interface Props {
  period: string;
  orderType: 'sales' | 'purchase';
  filters: AnalyticsDateFilters;
}

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

export default function CommodityAnalysis({ period, orderType, filters }: Props) {
  const [salesByCommodity, setSalesByCommodity] = useState<CommodityData[]>([]);
  const [purchaseByCommodity, setPurchaseByCommodity] = useState<CommodityData[]>([]);
  const [varietyBreakdown, setVarietyBreakdown] = useState<VarietyData[]>([]);
  const [priceTrends, setPriceTrends] = useState<Record<string, { date: string; rate: number }[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'distribution' | 'amount' | 'variety' | 'trends'>('distribution');
  const datasetLabel = orderType === 'sales' ? 'Sales' : 'Purchase';

  useEffect(() => {
    fetchData();
  }, [filters, orderType, period]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      const query = new URLSearchParams(
        Object.entries(buildAnalyticsFilterParams(filters, { orderType, period }))
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => [key, String(value)])
      );

      const response = await fetch(`${apiUrl}/analytics/commodity?${query.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        setSalesByCommodity(result.salesByCommodity || []);
        setPurchaseByCommodity(result.purchaseByCommodity || []);
        setVarietyBreakdown(result.varietyBreakdown || []);
        setPriceTrends(result.priceTrends || {});
      }
    } catch (error) {
      console.error('Failed to fetch commodity analytics:', error);
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

  const formatPercentLabel = (percent?: number) => {
    if (!percent || percent <= 0) return '0%';

    const percentage = percent * 100;
    if (percentage < 0.1) return '<0.1%';
    if (percentage < 1) return `${percentage.toFixed(1)}%`;
    return `${percentage.toFixed(0)}%`;
  };

  const activeCommodityData = (orderType === 'sales' ? salesByCommodity : purchaseByCommodity)
    .map((item) => ({
      ...item,
      avgRate: Math.round((item.avgRate || 0) * 100) / 100,
      minRate: Math.round((item.minRate || 0) * 100) / 100,
      maxRate: Math.round((item.maxRate || 0) * 100) / 100,
      weight: Math.round((item.weight || 0) * 1000) / 1000,
      amount: Math.round((item.amount || 0) * 100) / 100
    }))
    .sort((a, b) => b.amount - a.amount);

  const hasCommodityData =
    activeCommodityData.length > 0 ||
    varietyBreakdown.length > 0 ||
    Object.keys(priceTrends).length > 0;

  // Prepare data for pie chart
  const pieData = activeCommodityData.map((c, index) => ({
    name: c.commodity,
    value: c.orders,
    color: COLORS[index % COLORS.length]
  }));

  // Prepare variety donut data
  const varietyDonutData = varietyBreakdown.slice(0, 10).map((v, index) => ({
    name: `${v.commodity} - ${v.variety}`,
    value: v.amount,
    color: COLORS[index % COLORS.length]
  }));

  // Prepare price trends data for multi-line chart
  const allDates = new Set<string>();
  Object.values(priceTrends).forEach(trend => {
    trend.forEach(t => allDates.add(t.date));
  });
  
  const priceTrendData = Array.from(allDates).sort().map(date => {
    const dataPoint: { date: string; [key: string]: number | string } = { date };
    Object.entries(priceTrends).forEach(([commodity, trend]) => {
      const point = trend.find(t => t.date === date);
      if (point) {
        dataPoint[commodity] = point.rate;
      }
    });
    return dataPoint;
  });

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (!hasCommodityData) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-10 text-center text-gray-500">
        <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-lg font-medium text-gray-700">No commodity analytics available</p>
        <p className="text-sm mt-2">Confirmed sales or purchase order data is needed to populate this section.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveView('distribution')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeView === 'distribution'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Package className="w-4 h-4" />
          Distribution
        </button>
        <button
          onClick={() => setActiveView('amount')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeView === 'amount'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Amount Analysis
        </button>
        <button
          onClick={() => setActiveView('variety')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeView === 'variety'
              ? 'bg-purple-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Variety Breakdown
        </button>
        <button
          onClick={() => setActiveView('trends')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
            activeView === 'trends'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Price Trends
        </button>
      </div>

      {/* Charts */}
      {activeView === 'distribution' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-600" />
              {datasetLabel} Commodity-wise Distribution (Orders)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${formatPercentLabel(percent)})`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, _name, item: any) => {
                    const percent = item?.payload?.percent;
                    return [value, `Orders (${formatPercentLabel(percent)})`];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Commodity Summary</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {activeCommodityData.map((c, index) => (
                <div key={c.commodity} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="font-medium">{c.commodity}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{c.orders} orders</p>
                    <p className="text-sm text-gray-500">{c.weight.toFixed(2)} MT</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeView === 'amount' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            {datasetLabel} Commodity vs Amount
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={activeCommodityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                type="number" 
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                type="category" 
                dataKey="commodity" 
                width={100}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Amount']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              <Bar 
                dataKey="amount" 
                name="Total Amount" 
                fill="#10b981" 
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {activeView === 'variety' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-600" />
              Variety-wise Breakdown (Top 10)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={varietyDonutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                >
                  {varietyDonutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'Amount']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Variety Details</h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {varietyBreakdown.slice(0, 10).map((v, index) => (
                <div key={`${v.commodity}-${v.variety}`} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-sm">
                      <span className="font-medium">{v.commodity}</span>
                      <span className="text-gray-500"> - {v.variety}</span>
                    </span>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(v.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeView === 'trends' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            {datasetLabel} Commodity Price Trends
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={priceTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value: number) => [`₹${value.toLocaleString()}`, 'Rate/MT']}
                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
              />
              <Legend />
              {Object.keys(priceTrends).slice(0, 5).map((commodity, index) => (
                <Line
                  key={commodity}
                  type="monotone"
                  dataKey={commodity}
                  name={commodity}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: COLORS[index % COLORS.length], r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Price Statistics Table */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Commodity Price Statistics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 font-semibold">Commodity</th>
                <th className="text-right p-3 font-semibold">Avg Rate/MT</th>
                <th className="text-right p-3 font-semibold">Min Rate</th>
                <th className="text-right p-3 font-semibold">Max Rate</th>
                <th className="text-right p-3 font-semibold">Total Weight (MT)</th>
              </tr>
            </thead>
            <tbody>
              {activeCommodityData.map((c, index) => (
                <tr key={c.commodity} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="p-3 font-medium">{c.commodity}</td>
                  <td className="p-3 text-right">{formatCurrency(c.avgRate)}</td>
                  <td className="p-3 text-right text-red-600">{formatCurrency(c.minRate)}</td>
                  <td className="p-3 text-right text-green-600">{formatCurrency(c.maxRate)}</td>
                  <td className="p-3 text-right">{c.weight.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
