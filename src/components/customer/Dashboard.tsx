import { Profile, Order, Offer } from '../../lib/client';
import { Package, ShoppingCart, AlertCircle } from 'lucide-react';
import { AgmarknetDashboard } from '../agmarknet/AgmarknetDashboard';
import Weathersonu from '../weathersonu';

interface DashboardProps {
  profile: Profile | null;
  orders: Order[];
  offers: Offer[];
}


export default function Dashboard({ profile, orders, offers }: DashboardProps) {

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


  if (!profile) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-700">Loading profile...</p>
        </div>
      </div>
    );
  }

  const myOffers = offers.filter(o => o.seller_id === profile.id);
  const pendingOrders = orders.filter(o => o.status === 'Pending Approval');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">My Orders</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{orders.length}</p>
            </div>
            <ShoppingCart className="w-12 h-12 text-green-500 opacity-20" />
          </div>
        </div>

        {profile.role === 'farmer' && (
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Offers</p>
                <p className="text-3xl font-bold text-gray-800 mt-2">{myOffers.length}</p>
              </div>
              <Package className="w-12 h-12 text-blue-500 opacity-20" />
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">{pendingOrders.length}</p>
            </div>
            <AlertCircle className="w-12 h-12 text-orange-500 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-teal-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {orders.filter(o => o.status === 'Completed').length}
              </p>
            </div>
            <Package className="w-12 h-12 text-teal-500 opacity-20" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Location & Weather KPI Card - Only Weathersonu Component */}
        <Weathersonu />
      </div>

      {/* Mandi Bhav Component with all filters */}
      <AgmarknetDashboard />

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">Recent Orders</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commodity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity (MT)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price/Quintal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {order.offer?.commodity || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{order.quantity_mt}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">₹{order.final_price_per_quintal}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      order.status === 'Completed' ? 'bg-green-100 text-green-800' :
                      order.status === 'Pending Approval' ? 'bg-yellow-100 text-yellow-800' :
                      order.status === 'Approved' ? 'bg-blue-100 text-blue-800' :
                      order.status === 'Approved - Awaiting Logistics' ? 'bg-purple-100 text-purple-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(order.sauda_confirmation_date || order.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No orders yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
