import { useState, useEffect } from 'react';
import { FileText, RefreshCw, Eye, X } from 'lucide-react';

interface ConfirmedSalesOrder {
  id: string;
  invoice_number: string;
  transaction_date: string;
  customer_id: {
    id: string;
    name: string;
    email: string;
  };
  commodity: string;
  variety?: string;
  vehicle_no: string;
  net_weight_mt: number;
  rate_per_mt: number;
  gross_amount: number;
  total_deduction: number;
  net_amount: number;
  createdAt: string;
}

export default function AllConfirmedSalesOrders() {
  const [orders, setOrders] = useState<ConfirmedSalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchAllOrders();
  }, []);

  const fetchAllOrders = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const response = await fetch(`${apiUrl}/confirmed-sales-orders`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch confirmed sales orders');
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

  const formatDate = (dateStr: string) => {
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

  const toUpperText = (value?: string | null) => String(value ?? '').trim().toUpperCase();
  const toUpperOrDash = (value?: string | null) => {
    const normalized = toUpperText(value);
    return normalized || '-';
  };

  const fetchOrderDetails = async (orderId: string) => {
    setLoadingDetails(true);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`${apiUrl}/confirmed-sales-orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedOrder(data);
      }
    } catch (err: any) {
      console.error('Failed to fetch order details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading confirmed sales orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-8 h-8 text-green-600" />
          All Confirmed Sales Orders
        </h1>
        <button
          onClick={fetchAllOrders}
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

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Confirmed Sales Orders Found</h2>
          <p className="text-gray-600">Start by creating a confirmed sales order.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Invoice No.</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Customer</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Commodity</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Vehicle No.</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Net Weight (MT)</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Net Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.invoice_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(order.transaction_date)}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div>
                        <p className="font-medium">{order.customer_id?.name || 'Unknown'}</p>
                        <p className="text-gray-600 text-xs">{order.customer_id?.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {toUpperText(order.commodity)} {toUpperText(order.variety) && `- ${toUpperText(order.variety)}`}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.vehicle_no}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-bold">{order.net_weight_mt} MT</td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-bold">₹{order.net_amount.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          fetchOrderDetails(order.id);
                        }}
                        className="text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View
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
        Showing {orders.length} confirmed sales orders
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Confirmed Sales Order Details</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {loadingDetails ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading details...</p>
                </div>
              ) : selectedOrder && selectedOrder.id ? (
                <>
                  <div className="grid grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Invoice Number</p>
                      <p className="text-lg text-gray-900 font-bold">{selectedOrder.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Transaction Date</p>
                      <p className="text-lg text-gray-900 font-bold">{formatDate(selectedOrder.transaction_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Customer</p>
                      <p className="text-lg text-gray-900 font-bold">{selectedOrder.customer_id?.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-600">{selectedOrder.customer_id?.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">State</p>
                      <p className="text-lg text-gray-900 font-bold">{toUpperOrDash(selectedOrder.state)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Location</p>
                      <p className="text-lg text-gray-900 font-bold">{selectedOrder.location || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Warehouse</p>
                      <p className="text-lg text-gray-900 font-bold">{selectedOrder.warehouse_name || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Commodity</p>
                      <p className="text-lg text-gray-900 font-bold">{toUpperOrDash(selectedOrder.commodity)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Variety</p>
                      <p className="text-lg text-gray-900 font-bold">{toUpperOrDash(selectedOrder.variety)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Vehicle No.</p>
                      <p className="text-lg text-gray-900 font-bold">{selectedOrder.vehicle_no}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Weight Slip No.</p>
                      <p className="text-lg text-gray-900 font-bold">{selectedOrder.weight_slip_no || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Gross Weight (MT)</p>
                      <p className="text-lg text-gray-900 font-bold">{selectedOrder.gross_weight_mt || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Tare Weight (MT)</p>
                      <p className="text-lg text-gray-900 font-bold">{selectedOrder.tare_weight_mt || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">No. of Bags</p>
                      <p className="text-lg text-gray-900 font-bold">{selectedOrder.no_of_bags || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Net Weight (MT)</p>
                      <p className="text-lg text-gray-900 font-bold">{selectedOrder.net_weight_mt} MT</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Rate Per MT</p>
                      <p className="text-lg text-gray-900 font-bold">₹{selectedOrder.rate_per_mt.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 font-medium">Gross Amount</p>
                      <p className="text-lg text-gray-900 font-bold">₹{selectedOrder.gross_amount.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Quality Parameters */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Quality Parameters</h3>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">HLW (Wheat)</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.hlw_wheat || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Excess HLW</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.excess_hlw || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Deduction (HLW) ₹</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.deduction_amount_hlw || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Moisture (MOI)</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.moisture_moi || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Excess Moisture</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.excess_moisture || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">BDOI</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.bdoi || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Excess BDOI</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.excess_bdoi || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">MOI+BDOI</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.moi_bdoi || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Weight Deduction (KG)</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.weight_deduction_kg || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Deduction (MOI+BDOI) ₹</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.deduction_amount_moi_bdoi || 0}</p>
                      </div>
                    </div>
                  </div>

                  {/* Other Deductions */}
                  {(selectedOrder.other_deduction_1 || selectedOrder.other_deduction_2 || selectedOrder.other_deduction_3) && (
                    <div className="border-t border-gray-200 pt-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Other Deductions</h3>
                      <div className="grid grid-cols-5 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                          const value = selectedOrder[`other_deduction_${num}`] || 0;
                          if (value === 0) return null;
                          return (
                            <div key={num}>
                              <p className="text-sm text-gray-500 font-medium">Other {num} ₹</p>
                              <p className="text-lg text-gray-900 font-bold">{value}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Final Amounts */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Final Amounts</h3>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Total Deduction ₹</p>
                        <p className="text-2xl text-red-700 font-bold">₹{selectedOrder.total_deduction?.toLocaleString() || '0'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500 font-medium">Net Amount ₹</p>
                        <p className="text-3xl text-green-700 font-bold">₹{selectedOrder.net_amount.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {selectedOrder.remarks && (
                    <div className="border-t border-gray-200 pt-6">
                      <p className="text-sm text-gray-500 font-medium mb-2">Remarks</p>
                      <div className="bg-gray-50 p-4 rounded-lg text-gray-900 border border-gray-100">
                        {selectedOrder.remarks}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
