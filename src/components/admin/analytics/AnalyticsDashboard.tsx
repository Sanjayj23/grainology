import { useEffect, useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Package, 
  Users, 
  GitCompare, 
  FileText,
  Calendar,
  RefreshCw,
  Download
} from 'lucide-react';
import TimeBasedCharts from './TimeBasedCharts';
import CommodityAnalysis from './CommodityAnalysis';
import CustomerAnalysis from './CustomerAnalysis';
import ComparativeReports from './ComparativeReports';
import TabularReports from './TabularReports';
import {
  getAnalyticsMonthOptions,
  getAnalyticsWeekOptions,
  exportAnalyticsWorkbook,
  getAnalyticsFilterSummary,
  getAnalyticsYearOptions,
  type AnalyticsDateFilters,
  type AnalyticsFilterMode,
  type AnalyticsOrderType
} from '../../../lib/analyticsExport';
import { usePopupContext } from '../../../contexts/PopupContext';

type TabType = 'time-based' | 'commodity' | 'customer' | 'comparison' | 'reports';

const tabs: { key: TabType; label: string; icon: React.ElementType; color: string }[] = [
  { key: 'time-based', label: 'Time Analysis', icon: TrendingUp, color: 'blue' },
  { key: 'commodity', label: 'Commodity', icon: Package, color: 'emerald' },
  { key: 'customer', label: 'Trade Name', icon: Users, color: 'purple' },
  { key: 'comparison', label: 'Comparative', icon: GitCompare, color: 'amber' },
  { key: 'reports', label: 'Table Reports', icon: FileText, color: 'indigo' }
];

const groupByOptions = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' }
];

export default function AnalyticsDashboard() {
  const { showAlert } = usePopupContext();
  const [activeTab, setActiveTab] = useState<TabType>('time-based');
  const [groupBy, setGroupBy] = useState('month');
  const [orderType, setOrderType] = useState<AnalyticsOrderType>('purchase');
  const currentYear = new Date().getFullYear();
  const [filterMode, setFilterMode] = useState<AnalyticsFilterMode>('year');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState<string>(`${currentYear}-12-31`);
  const [compareYear, setCompareYear] = useState<number>(currentYear - 1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const years = getAnalyticsYearOptions();
  const monthOptions = getAnalyticsMonthOptions();
  const weekOptions = getAnalyticsWeekOptions();
  const analyticsFilters: AnalyticsDateFilters = {
    filterMode,
    year: selectedYear,
    month: selectedMonth,
    week: selectedWeek,
    startDate,
    endDate
  };

  useEffect(() => {
    if (compareYear === selectedYear) {
      const fallbackYear = [...years].reverse().find((year) => year !== selectedYear);
      if (fallbackYear) {
        setCompareYear(fallbackYear);
      }
    }
  }, [compareYear, selectedYear, years]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleExportAllData = async () => {
    try {
      setExporting(true);
      await exportAnalyticsWorkbook({
        orderType,
        filters: analyticsFilters,
        compareYear,
        groupBy
      });
    } catch (error) {
      console.error('Failed to export analytics workbook:', error);
      await showAlert({
        title: 'Export Failed',
        message: error instanceof Error ? error.message : 'Failed to export analytics workbook',
        tone: 'danger',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-full mx-auto p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Analytics Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Comprehensive insights from your orders data</p>
          <p className="text-sm text-gray-500 mt-1">{getAnalyticsFilterSummary(analyticsFilters)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value as AnalyticsOrderType)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="purchase">Purchase Analytics</option>
            <option value="sales">Sales Analytics</option>
          </select>

          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value as AnalyticsFilterMode)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="year">Year Wise</option>
            <option value="month">Month Wise</option>
            <option value="week">Week Wise</option>
            <option value="date-range">Date Range Wise</option>
          </select>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {years.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {filterMode === 'month' && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          )}

          {filterMode === 'week' && (
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {weekOptions.map((week) => (
                <option key={week.value} value={week.value}>{week.label}</option>
              ))}
            </select>
          )}

          {filterMode === 'date-range' && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </>
          )}

          {/* Group By (for time-based) */}
          {activeTab === 'time-based' && (
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {groupByOptions.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          )}

          {activeTab === 'comparison' && (
            <select
              value={compareYear}
              onChange={(e) => setCompareYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {years.filter((year) => year !== selectedYear).map((year) => (
                <option key={year} value={year}>Compare {year}</option>
              ))}
            </select>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-lg p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === key
                  ? `bg-${color}-600 text-white shadow-md`
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              style={activeTab === key ? {
                backgroundColor: color === 'blue' ? '#2563eb' :
                                 color === 'emerald' ? '#059669' :
                                 color === 'purple' ? '#9333ea' :
                                 color === 'amber' ? '#d97706' :
                                 '#4f46e5'
              } : {}}
            >
              <Icon className="w-5 h-5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div key={refreshKey}>
        {activeTab === 'time-based' && (
          <TimeBasedCharts period="all" groupBy={groupBy} orderType={orderType} filters={analyticsFilters} />
        )}

        {activeTab === 'commodity' && (
          <CommodityAnalysis period="all" orderType={orderType} filters={analyticsFilters} />
        )}

        {activeTab === 'customer' && (
          <CustomerAnalysis period="all" type={orderType} filters={analyticsFilters} />
        )}

        {activeTab === 'comparison' && (
          <ComparativeReports period="all" orderType={orderType} filters={analyticsFilters} compareYear={compareYear} />
        )}

        {activeTab === 'reports' && (
          <TabularReports period="all" orderType={orderType} filters={analyticsFilters} />
        )}
      </div>

      {/* Quick Stats Footer */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Need Custom Reports?</h3>
            <p className="text-blue-100 text-sm mt-1">
              Download the exact analytics dashboard data in Excel with the active dataset and date filters
            </p>
          </div>
          <button
            onClick={handleExportAllData}
            disabled={exporting}
            className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className="w-5 h-5" />
            {exporting ? 'Exporting Excel...' : 'Export All Data'}
          </button>
        </div>
      </div>
    </div>
  );
}
