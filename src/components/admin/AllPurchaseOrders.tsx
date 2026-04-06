import { useState, useEffect } from 'react';
import { ShoppingCart, RefreshCw, Eye, X } from 'lucide-react';

interface PurchaseOrder {
  id: string;
  commodity: string;
  variety?: string;
  quantity_mt: number;
  expected_price_per_quintal?: number;
  delivery_location: string;
  sauda_confirmation_date?: string;
  payment_terms?: string;
  status: string;
  notes?: string;
  quality_requirements?: Record<string, string>;
  buyer_id?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

interface AllPurchaseOrdersProps {
  currentUserRole: string;
}

export default function AllPurchaseOrders({ currentUserRole }: AllPurchaseOrdersProps) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [editForm, setEditForm] = useState({
    commodity: '',
    variety: '',
    quantity_mt: '',
    expected_price_per_quintal: '',
    delivery_location: '',
    sauda_confirmation_date: '',
    payment_terms: 'Against Delivery',
    status: 'Open',
    notes: ''
  });
  const isSuperAdmin = currentUserRole === 'super_admin';

  const statuses = ['All', 'Open', 'In Negotiation', 'Confirmed', 'Completed', 'Cancelled'];

  useEffect(() => {
    fetchAllPurchaseOrders();
  }, []);

  const fetchAllPurchaseOrders = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const response = await fetch(`${apiUrl}/purchase-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch purchase orders');
      }

      const data = await response.json();
      setOrders(Array.isArray(data) ? data : data.data || []);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = filterStatus === 'All' 
    ? orders 
    : orders.filter(o => o.status === filterStatus);

  const formatDate = (dateStr: string | undefined, fallbackDate?: string) => {
    const dateToUse = dateStr || fallbackDate;
    if (!dateToUse) return '-';
    try {
      const date = new Date(dateToUse);
      if (isNaN(date.getTime())) return dateToUse;
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateToUse;
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(orderId);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`${apiUrl}/purchase-orders/${orderId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update order status');
      }

      await fetchAllPurchaseOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const openOrder = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    setIsEditing(false);
    setEditForm({
      commodity: order.commodity || '',
      variety: order.variety || '',
      quantity_mt: String(order.quantity_mt ?? ''),
      expected_price_per_quintal: String(order.expected_price_per_quintal ?? ''),
      delivery_location: order.delivery_location || '',
      sauda_confirmation_date: order.sauda_confirmation_date ? order.sauda_confirmation_date.slice(0, 10) : '',
      payment_terms: order.payment_terms || 'Against Delivery',
      status: order.status || 'Open',
      notes: order.notes || ''
    });
  };

  const saveOrderEdits = async () => {
    if (!selectedOrder) return;

    try {
      setSavingOrder(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`${apiUrl}/purchase-orders/${selectedOrder.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commodity: editForm.commodity.trim(),
          variety: editForm.variety.trim(),
          quantity_mt: Number(editForm.quantity_mt) || 0,
          expected_price_per_quintal: editForm.expected_price_per_quintal ? Number(editForm.expected_price_per_quintal) : undefined,
          delivery_location: editForm.delivery_location.trim(),
          sauda_confirmation_date: editForm.sauda_confirmation_date || undefined,
          payment_terms: editForm.payment_terms,
          status: editForm.status,
          notes: editForm.notes.trim() || undefined
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save purchase order changes');
      }

      const updated = await response.json();
      setSelectedOrder(updated);
      setIsEditing(false);
      await fetchAllPurchaseOrders();
    } catch (err: any) {
      setError(err.message || 'Failed to save purchase order');
    } finally {
      setSavingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading purchase orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart className="w-8 h-8 text-green-600" />
          All Purchase Orders
        </h1>
        <button
          onClick={fetchAllPurchaseOrders}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-800 p-4">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === status
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Purchase Orders Found</h2>
          <p className="text-gray-600">No purchase orders with status "{filterStatus}" yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Buyer</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Commodity</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Variety</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Quantity (MT)</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Expected Price</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Payment Terms</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Created</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>
                        <p className="font-medium">{order.buyer_id?.name || 'Unknown'}</p>
                        <p className="text-gray-600 text-xs">{order.buyer_id?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{order.commodity}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.variety || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{order.quantity_mt}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {order.expected_price_per_quintal ? `₹${order.expected_price_per_quintal}/qt` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.payment_terms}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        order.status === 'Open' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'In Negotiation' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'Confirmed' ? 'bg-green-100 text-green-800' :
                        order.status === 'Completed' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => openOrder(order)}
                        className="text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        {isSuperAdmin ? 'View / Edit' : 'View'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredOrders.length} of {orders.length} orders
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Purchase Order Details</h2>
              <div className="flex items-center gap-3">
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsEditing((prev) => !prev)}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    {isEditing ? 'Cancel Edit' : 'Edit Order'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-gray-500 font-medium">Buyer</p>
                  <p className="text-lg text-gray-900 font-bold">{selectedOrder.buyer_id?.name || 'Unknown'}</p>
                  <p className="text-sm text-gray-600">{selectedOrder.buyer_id?.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Commodity</p>
                  {isEditing ? (
                    <input
                      value={editForm.commodity}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, commodity: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  ) : (
                    <p className="text-lg text-gray-900 font-bold">{selectedOrder.commodity}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Variety</p>
                  {isEditing ? (
                    <input
                      value={editForm.variety}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, variety: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  ) : (
                    <p className="text-lg text-gray-900 font-bold">{selectedOrder.variety || '-'}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Quantity</p>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.001"
                      value={editForm.quantity_mt}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, quantity_mt: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  ) : (
                    <p className="text-lg text-gray-900 font-bold">{selectedOrder.quantity_mt} MT</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Expected Price / Quintal</p>
                  {isEditing ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.expected_price_per_quintal}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, expected_price_per_quintal: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  ) : (
                    <p className="text-lg text-gray-900 font-bold">
                      ₹{selectedOrder.expected_price_per_quintal?.toLocaleString() || 0}/qt
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Sauda Date</p>
                  {isEditing ? (
                    <input
                      type="date"
                      value={editForm.sauda_confirmation_date}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, sauda_confirmation_date: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  ) : (
                    <p className="text-lg text-gray-900 font-bold">
                      {formatDate(selectedOrder.sauda_confirmation_date, selectedOrder.createdAt)}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Delivery Location</p>
                  {isEditing ? (
                    <input
                      value={editForm.delivery_location}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, delivery_location: e.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  ) : (
                    <p className="text-lg text-gray-900 font-bold">{selectedOrder.delivery_location}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Status</p>
                  <select
                    value={isEditing ? editForm.status : selectedOrder.status}
                    onChange={(e) => isEditing
                      ? setEditForm((prev) => ({ ...prev, status: e.target.value }))
                      : updateOrderStatus(selectedOrder.id, e.target.value)}
                    disabled={!isEditing && updatingStatus === selectedOrder.id}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white font-bold"
                  >
                    <option value="Open">Open</option>
                    <option value="In Negotiation">In Negotiation</option>
                    <option value="Confirmed">Confirmed</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">System Entry Date</p>
                  <p className="text-gray-900 font-bold">{new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Payment Terms</p>
                  {isEditing ? (
                    <select
                      value={editForm.payment_terms}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, payment_terms: e.target.value }))}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                    >
                      <option value="Advance">Advance</option>
                      <option value="T+3 Days">T+3 Days</option>
                      <option value="Against Delivery">Against Delivery</option>
                    </select>
                  ) : (
                    <p className="text-lg text-gray-900 font-bold">{selectedOrder.payment_terms}</p>
                  )}
                </div>
              </div>

              {selectedOrder.quality_requirements && Object.keys(selectedOrder.quality_requirements).length > 0 && (
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-bold text-gray-800 mb-4 uppercase tracking-wider">Quality Parameters (Particulars)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {Object.entries(selectedOrder.quality_requirements).map(([param, value]) => (
                      <div key={param} className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                        <p className="text-xs text-yellow-700 font-medium mb-1">{param}</p>
                        <p className="text-sm text-gray-900 font-bold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(selectedOrder.notes || isEditing) && (
                <div className="border-t border-gray-200 pt-6">
                  <p className="text-sm text-gray-500 font-medium mb-2">Remarks / Notes</p>
                  {isEditing ? (
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                      rows={4}
                      className="w-full rounded-lg border border-gray-300 px-4 py-3"
                    />
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-lg text-gray-900 border border-gray-100 italic">
                      {selectedOrder.notes}
                    </div>
                  )}
                </div>
              )}

              {isEditing && isSuperAdmin && (
                <div className="border-t border-gray-200 pt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={saveOrderEdits}
                    disabled={savingOrder}
                    className="px-5 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {savingOrder ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
