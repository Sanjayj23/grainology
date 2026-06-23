import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Package, ShoppingCart, TrendingUp, CheckCircle, UserCheck, MapPin, Warehouse } from 'lucide-react';
import { AgmarknetDashboard } from '../agmarknet/AgmarknetDashboard';
import Weathersonu from '../weathersonu';
import { DashboardCache } from '../../lib/sessionStorage';

interface ConfirmedOrderRow {
  _id?: string;
  invoice_number: string;
  transaction_date: string;
  commodity: string;
  orderType: 'sales' | 'purchase';
  partyName: string;
  net_weight_mt: number;
  net_amount: number;
  createdAt: string;
}

interface VendorPerformanceRow {
  name: string;
  totalOrders: number;
  totalAmount: number;
}

interface EnhancedDashboardProps {
  userId: string;
  dataVersion?: number;
  stats: {
    totalUsers: number;
    totalFarmers: number;
    totalTraders: number;
    totalCorporates?: number;
    totalFpos?: number;
    totalMillers?: number;
    totalFinancers?: number;
    totalAdmins?: number;
    totalSuperAdmins?: number;
    verifiedUsers: number;
    pendingApprovalUsers?: number;
    locationPendingCount?: number;
    locationApprovedCount?: number;
    locationDeclinedCount?: number;
    warehousePendingCount?: number;
    warehouseApprovedCount?: number;
    warehouseDeclinedCount?: number;
    confirmedOrdersPendingCount?: number;
    confirmedOrdersApprovedCount?: number;
    confirmedOrdersDeclinedCount?: number;
    totalPurchaseOrders: number;
    totalSaleOrders: number;
    totalConfirmedSalesOrders: number;
    totalConfirmedPurchaseOrders: number;
    totalConfirmedSalesAmount: number;
    totalConfirmedPurchaseAmount: number;
  };
  onPendingApprovalClick?: () => void;
}

export default function EnhancedDashboard({ userId, dataVersion, stats, onPendingApprovalClick }: EnhancedDashboardProps) {
  const [recentOrders, setRecentOrders] = useState<ConfirmedOrderRow[]>([]);
  const [vendorPerformance, setVendorPerformance] = useState<VendorPerformanceRow[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const lastDashboardVersionRef = useRef<number>(0);

  // Add safety checks for stats
  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard data...</div>
      </div>
    );
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const loadDashboardData = useCallback(async (force = false) => {
    try {
      if (!force) {
        const cached = DashboardCache.getAdminDashboardData(userId) as
          | { recentOrders?: ConfirmedOrderRow[]; vendorPerformance?: VendorPerformanceRow[]; dataVersion?: number }
          | null;
        if (cached) {
          setRecentOrders(cached.recentOrders || []);
          setVendorPerformance(cached.vendorPerformance || []);
          if (typeof cached.dataVersion === 'number') {
            lastDashboardVersionRef.current = cached.dataVersion;
          }
          setDashboardLoading(false);
          return;
        }
      }

      setDashboardLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setDashboardLoading(false);
        return;
      }

      const response = await fetch(`${apiUrl}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setDashboardLoading(false);
        return;
      }

      const data = await response.json();
      const nextRecentOrders = data.recentOrders || [];
      const nextVendorPerformance = data.vendorPerformance || [];
      const nextDataVersion = Number(data.dataVersion || dataVersion || Date.now());

      setRecentOrders(nextRecentOrders);
      setVendorPerformance(nextVendorPerformance);
      lastDashboardVersionRef.current = nextDataVersion;

      DashboardCache.setAdminDashboardData(userId, {
        recentOrders: nextRecentOrders,
        vendorPerformance: nextVendorPerformance,
        dataVersion: nextDataVersion,
      });
      DashboardCache.setAdminDataVersion(userId, nextDataVersion);
    } catch (err) {
      console.error('Dashboard data load error:', err);
    } finally {
      setDashboardLoading(false);
    }
  }, [userId, dataVersion]);

  useEffect(() => {
    const cached = DashboardCache.getAdminDashboardData(userId) as
      | { recentOrders?: ConfirmedOrderRow[]; vendorPerformance?: VendorPerformanceRow[]; dataVersion?: number }
      | null;

    if (cached) {
      setRecentOrders(cached.recentOrders || []);
      setVendorPerformance(cached.vendorPerformance || []);
      if (typeof cached.dataVersion === 'number') {
        lastDashboardVersionRef.current = cached.dataVersion;
      }
      setDashboardLoading(false);
      void loadDashboardData(false);
      return;
    }

    void loadDashboardData(true);
  }, [userId, loadDashboardData]);

  useEffect(() => {
    const normalizedVersion = Number(dataVersion || 0);
    if (!normalizedVersion) return;
    if (normalizedVersion <= lastDashboardVersionRef.current) return;
    void loadDashboardData(true);
  }, [dataVersion, loadDashboardData]);




  return (
    <div className="space-y-6">
      {/* Pending Approval – users who just signed up, need to be approved */}
      {(stats?.pendingApprovalUsers ?? 0) > 0 && (
        <div className="rounded-lg shadow-lg p-4 bg-amber-50 border-2 border-amber-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-200 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <p className="font-semibold text-amber-900">
                  {stats.pendingApprovalUsers} user{stats.pendingApprovalUsers !== 1 ? 's' : ''} pending approval
                </p>
                <p className="text-sm text-amber-800">New sign-ups waiting for approval to login</p>
              </div>
            </div>
            {onPendingApprovalClick && (
              <button
                type="button"
                onClick={onPendingApprovalClick}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium"
              >
                Approve in User Management
              </button>
            )}
          </div>
        </div>
      )}

      {/* First Row: All Users, Total Purchase Orders, Total Sales Orders, Total Confirmed Sales Orders */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">All Users</p>
              <p className="text-4xl font-bold mt-2">{stats?.totalUsers || 0}</p>
              <div className="text-xs opacity-85 mt-2 space-y-1">
                <p>
                  {stats?.totalFarmers || 0} Farmers | {stats?.totalTraders || 0} Traders | {stats?.totalCorporates || 0} Corporate
                </p>
                <p>
                  {stats?.totalFpos || 0} FPO | {stats?.totalMillers || 0} Miller | {stats?.totalFinancers || 0} Financer
                </p>
                <p>
                  {stats?.totalAdmins || 0} Admin | {stats?.totalSuperAdmins || 0} Super Admin
                </p>
              </div>
            </div>
            <Users className="w-12 h-12 opacity-30" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Purchase Orders</p>
              <p className="text-4xl font-bold mt-2">{stats?.totalPurchaseOrders || 0}</p>
              <p className="text-xs opacity-75 mt-1">All purchase orders</p>
            </div>
            <Package className="w-12 h-12 opacity-30" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Sales Orders</p>
              <p className="text-4xl font-bold mt-2">{stats?.totalSaleOrders || 0}</p>
              <p className="text-xs opacity-75 mt-1">All sales orders</p>
            </div>
            <ShoppingCart className="w-12 h-12 opacity-30" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Confirmed Sales Orders</p>
              <p className="text-4xl font-bold mt-2">{stats?.totalConfirmedSalesOrders || 0}</p>
              <p className="text-xs opacity-75 mt-1">Total confirmed</p>
            </div>
            <CheckCircle className="w-12 h-12 opacity-30" />
          </div>
        </div>
      </div>

      {/* Second Row: Total Confirmed Purchase Orders, Total Amount Confirmed Sales, Total Amount Confirmed Purchase */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Confirmed Purchase Orders</p>
              <p className="text-4xl font-bold mt-2">{stats?.totalConfirmedPurchaseOrders || 0}</p>
              <p className="text-xs opacity-75 mt-1">Total confirmed</p>
            </div>
            <CheckCircle className="w-12 h-12 opacity-30" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Confirmed Sales Amount</p>
              <p className="text-3xl font-bold mt-2">₹{(stats?.totalConfirmedSalesAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs opacity-75 mt-2">All confirmed sales orders</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-90">Total Confirmed Purchase Amount</p>
              <p className="text-3xl font-bold mt-2">₹{(stats?.totalConfirmedPurchaseAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-xs opacity-75 mt-2">All confirmed purchase orders</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Location Approvals</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {(stats?.locationPendingCount || 0) + (stats?.locationApprovedCount || 0) + (stats?.locationDeclinedCount || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Locations by approval status</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-emerald-700" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-700 uppercase">Pending</p>
              <p className="text-xl font-bold text-amber-900">{stats?.locationPendingCount || 0}</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-green-700 uppercase">Approved</p>
              <p className="text-xl font-bold text-green-900">{stats?.locationApprovedCount || 0}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-red-700 uppercase">Rejected</p>
              <p className="text-xl font-bold text-red-900">{stats?.locationDeclinedCount || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Warehouse Approvals</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                {(stats?.warehousePendingCount || 0) + (stats?.warehouseApprovedCount || 0) + (stats?.warehouseDeclinedCount || 0)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Warehouses by approval status</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Warehouse className="w-6 h-6 text-blue-700" />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-amber-700 uppercase">Pending</p>
              <p className="text-xl font-bold text-amber-900">{stats?.warehousePendingCount || 0}</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-green-700 uppercase">Approved</p>
              <p className="text-xl font-bold text-green-900">{stats?.warehouseApprovedCount || 0}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-[11px] font-semibold text-red-700 uppercase">Rejected</p>
              <p className="text-xl font-bold text-red-900">{stats?.warehouseDeclinedCount || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-100 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">All Confirmed Orders Approval</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {(stats?.confirmedOrdersPendingCount || 0) + (stats?.confirmedOrdersApprovedCount || 0) + (stats?.confirmedOrdersDeclinedCount || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Combined Sales + Purchase confirmed orders</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-slate-700" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-amber-700 uppercase">Pending</p>
            <p className="text-xl font-bold text-amber-900">{stats?.confirmedOrdersPendingCount || 0}</p>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-green-700 uppercase">Approved</p>
            <p className="text-xl font-bold text-green-900">{stats?.confirmedOrdersApprovedCount || 0}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-[11px] font-semibold text-red-700 uppercase">Rejected</p>
            <p className="text-xl font-bold text-red-900">{stats?.confirmedOrdersDeclinedCount || 0}</p>
          </div>
        </div>
      </div>

      {/* Location & Weather Component */}
      <div className="grid grid-cols-1 gap-6">
        <Weathersonu />
      </div>

      {/* Mandi Bhav Component with all filters */}
      <AgmarknetDashboard />

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Recent Orders</h3>
          <p className="text-sm text-gray-500 mt-1">From Confirmed Sales & Purchase Orders</p>
        </div>
        <div className="overflow-x-auto">
          {dashboardLoading ? (
            <div className="text-center py-12 text-gray-500">Loading recent orders...</div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commodity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller / Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight (MT)</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentOrders.map((order, index) => (
                    <tr key={`${order.orderType}-${order.id || index}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          order.orderType === 'sales' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {order.orderType === 'sales' ? 'Sales' : 'Purchase'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(order.transaction_date || order.createdAt)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.commodity || '–'}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{order.partyName || '–'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{Number(order.net_weight_mt ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 3 })}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">₹{(Number(order.net_amount ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {recentOrders.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No confirmed orders yet</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Vendor Performance (Seller/Supplier from Confirmed Sales & Purchase Orders) */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-800">Vendor Performance</h3>
          </div>
          <p className="text-sm text-gray-500 mt-1">By order count from Confirmed Sales & Purchase Orders</p>
        </div>
        <div className="p-6">
          {dashboardLoading ? (
            <p className="text-gray-500 text-center py-8">Loading performance data...</p>
          ) : vendorPerformance.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No vendor data yet</p>
          ) : (
            <div className="space-y-4">
              {vendorPerformance.map((vendor, index) => {
                const maxOrders = Math.max(...vendorPerformance.map(v => v.totalOrders), 1);
                const pct = maxOrders > 0 ? Math.round((vendor.totalOrders / maxOrders) * 100) : 0;
                return (
                  <div key={`${vendor.name}-${index}`} className="border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <p className="font-medium text-gray-800">{vendor.name}</p>
                        <p className="text-xs text-gray-500">{vendor.totalOrders} orders · ₹{(vendor.totalAmount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-sm font-bold bg-green-100 text-green-800">
                        {vendor.totalOrders} orders
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-green-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
