import { useState, useEffect } from 'react';
import { FileText, Eye, X, Download } from 'lucide-react';
import { generateOrderPDF } from '../../utils/pdfGenerator';

interface ConfirmedSalesOrder {
  id: string;
  invoice_number: string;
  transaction_date: string;
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

interface ConfirmedSalesOrderHistoryProps {
  userId: string;
}

export default function ConfirmedSalesOrderHistory({ userId }: ConfirmedSalesOrderHistoryProps) {
  const [orders, setOrders] = useState<ConfirmedSalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    fetchOrders();
  }, [userId]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      const response = await fetch(`${apiUrl}/confirmed-sales-orders/customer/${userId}`, {
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderDetails = async (orderId: string) => {
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const toUpperText = (value?: string | null) => String(value ?? '').trim().toUpperCase();
  const toUpperOrNA = (value?: string | null) => {
    const normalized = toUpperText(value);
    return normalized || 'N/A';
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
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <FileText className="w-8 h-8 text-green-600" />
          Confirmed Sales Orders
        </h1>
        <p className="text-gray-600">View all your confirmed sales orders</p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-800 p-4">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Confirmed Sales Orders Yet</h2>
          <p className="text-gray-600">Your confirmed sales orders will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">Date</th>
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
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDate(order.transaction_date)}</td>
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

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-6 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Confirmed Sales Order Details</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => generateOrderPDF(selectedOrder, 'sales')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-8">
              {selectedOrder.id ? (
                <>
                  {/* Transaction Details */}
                  <div className="border-b border-gray-200 pb-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Transaction Details</h3>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Transaction Date</p>
                        <p className="text-lg text-gray-900 font-bold">{formatDate(selectedOrder.transaction_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">State</p>
                        <p className="text-lg text-gray-900">{toUpperOrNA(selectedOrder.state)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Seller Name</p>
                        <p className="text-lg text-gray-900">{selectedOrder.seller_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Location</p>
                        <p className="text-lg text-gray-900">{selectedOrder.location || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Warehouse</p>
                        <p className="text-lg text-gray-900">{selectedOrder.warehouse_name || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Chamber No.</p>
                        <p className="text-lg text-gray-900">{selectedOrder.chamber_no || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Delivery Location</p>
                        <p className="text-lg text-gray-900">{selectedOrder.delivery_location || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Commodity Details */}
                  <div className="border-b border-gray-200 pb-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Commodity Details</h3>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Commodity</p>
                        <p className="text-lg text-gray-900 font-bold">{toUpperOrNA(selectedOrder.commodity)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Variety</p>
                        <p className="text-lg text-gray-900 font-bold">{toUpperOrNA(selectedOrder.variety)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Gate Pass No.</p>
                        <p className="text-lg text-gray-900">{selectedOrder.gate_pass_no || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle & Weight Details */}
                  <div className="border-b border-gray-200 pb-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Vehicle & Weight Details</h3>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Vehicle No.</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.vehicle_no}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Weight Slip No.</p>
                        <p className="text-lg text-gray-900">{selectedOrder.weight_slip_no || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">No. of Bags</p>
                        <p className="text-lg text-gray-900">{selectedOrder.no_of_bags || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Gross Weight (MT)</p>
                        <p className="text-lg text-gray-900">{selectedOrder.gross_weight_mt?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Tare Weight (MT)</p>
                        <p className="text-lg text-gray-900">{selectedOrder.tare_weight_mt?.toFixed(2) || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Net Weight (MT)</p>
                        <p className="text-lg text-gray-900 font-bold">{selectedOrder.net_weight_mt?.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Financial Details */}
                  <div className="border-b border-gray-200 pb-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Financial Details</h3>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Rate Per MT</p>
                        <p className="text-lg text-gray-900">₹{selectedOrder.rate_per_mt?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Gross Amount</p>
                        <p className="text-lg text-gray-900 font-bold">₹{selectedOrder.gross_amount?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Total Deduction</p>
                        <p className="text-lg text-gray-900 text-red-600 font-bold">₹{selectedOrder.total_deduction?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0.00'}</p>
                      </div>
                      <div className="col-span-3">
                        <p className="text-sm text-gray-500 font-medium">Net Amount</p>
                        <p className="text-2xl text-green-700 font-bold">₹{selectedOrder.net_amount?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>

                  {/* Quality Parameters */}
                  {(selectedOrder.hlw_wheat || selectedOrder.moisture_moi || selectedOrder.bdoi) && (
                    <div className="border-b border-gray-200 pb-6 mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Quality Parameters</h3>
                      <div className="grid grid-cols-3 gap-6">
                        {selectedOrder.hlw_wheat && (
                          <>
                            <div>
                              <p className="text-sm text-gray-500 font-medium">HLW (Wheat)</p>
                              <p className="text-lg text-gray-900">{selectedOrder.hlw_wheat}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Excess HLW</p>
                              <p className="text-lg text-gray-900">{selectedOrder.excess_hlw || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Deduction Amount (HLW) ₹</p>
                              <p className="text-lg text-gray-900 text-red-600">₹{selectedOrder.deduction_amount_hlw?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0.00'}</p>
                            </div>
                          </>
                        )}
                        {selectedOrder.moisture_moi && (
                          <>
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Moisture (MOI)</p>
                              <p className="text-lg text-gray-900">{selectedOrder.moisture_moi}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Excess Moisture</p>
                              <p className="text-lg text-gray-900">{selectedOrder.excess_moisture || 'N/A'}</p>
                            </div>
                          </>
                        )}
                        {selectedOrder.bdoi && (
                          <>
                            <div>
                              <p className="text-sm text-gray-500 font-medium">BDOI</p>
                              <p className="text-lg text-gray-900">{selectedOrder.bdoi}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Excess BDOI</p>
                              <p className="text-lg text-gray-900">{selectedOrder.excess_bdoi || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 font-medium">MOI+BDOI</p>
                              <p className="text-lg text-gray-900">{selectedOrder.moi_bdoi || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Weight Deduction (KG)</p>
                              <p className="text-lg text-gray-900">{selectedOrder.weight_deduction_kg || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500 font-medium">Deduction Amount (MOI+BDOI) ₹</p>
                              <p className="text-lg text-gray-900 text-red-600">₹{selectedOrder.deduction_amount_moi_bdoi?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '0.00'}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedOrder.other_deductions && selectedOrder.other_deductions.length > 0 && (
                    <div className="border-t border-gray-200 pt-6">
                      <p className="text-sm text-gray-500 font-medium mb-4">Other Deductions</p>
                      <div className="space-y-3">
                        {selectedOrder.other_deductions.map((deduction: any, index: number) => (
                          <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-sm font-semibold text-gray-700">Deduction {index + 1}:</span>
                                  <span className="text-lg font-bold text-red-600">₹{deduction.amount?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                                </div>
                                {deduction.remarks && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">Remarks:</span> {deduction.remarks}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedOrder.remarks && (
                    <div className="border-t border-gray-200 pt-6">
                      <p className="text-sm text-gray-500 font-medium mb-2">Remarks</p>
                      <div className="bg-gray-50 p-4 rounded-lg text-gray-900 border border-gray-100">
                        {selectedOrder.remarks}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading details...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
