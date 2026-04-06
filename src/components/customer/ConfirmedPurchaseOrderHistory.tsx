import { useState, useEffect } from 'react';
import { FileText, Eye, X, Download } from 'lucide-react';
import { generateOrderPDF } from '../../utils/pdfGenerator';

interface ConfirmedPurchaseOrder {
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
  state?: string;
  supplier_name?: string;
  location?: string;
  warehouse_name?: string;
  chamber_no?: string;
  gate_pass_no?: string;
  weight_slip_no?: string;
  gross_weight_mt?: number;
  tare_weight_mt?: number;
  no_of_bags?: number;
  hlw_wheat?: number;
  excess_hlw?: number;
  deduction_amount_hlw?: number;
  moisture_moi?: number;
  excess_moisture?: number;
  bddi?: number;
  excess_bddi?: number;
  moi_bddi?: number;
  weight_deduction_kg?: number;
  deduction_amount_moi_bddi?: number;
  other_deductions?: Array<{ amount: number; remarks: string }>;
  quality_report?: Record<string, any>;
  delivery_location?: string;
  remarks?: string;
  createdAt?: string;
}

interface ConfirmedPurchaseOrderHistoryProps {
  userId: string;
  userName: string;
}

export default function ConfirmedPurchaseOrderHistory({ userId, userName }: ConfirmedPurchaseOrderHistoryProps) {
  const [orders, setOrders] = useState<ConfirmedPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<ConfirmedPurchaseOrder | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [userId]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`${apiUrl}/confirmed-purchase-orders/customer/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch confirmed purchase orders');
      }

      const data = await response.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const toUpperText = (value?: string | null) => String(value ?? '').trim().toUpperCase();
  const toUpperOrNA = (value?: string | null) => {
    const normalized = toUpperText(value);
    return normalized || 'N/A';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading confirmed purchase orders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <FileText className="w-8 h-8 text-blue-600" />
          Confirmed Purchase Orders
        </h1>
        <p className="text-gray-600">View your confirmed purchase order history</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Confirmed Purchase Orders Found</h2>
          <p className="text-gray-600">Your confirmed purchase orders will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Commodity
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Vehicle No.
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Net Weight (MT)
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Net Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(order.transaction_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {toUpperText(order.commodity)} {toUpperText(order.variety) && `(${toUpperText(order.variety)})`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.vehicle_no}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.net_weight_mt?.toFixed(2)} MT
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCurrency(order.net_amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
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

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Purchase Order Details
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                    Purchase Order
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => generateOrderPDF(selectedOrder, 'purchase')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-3 gap-6">
                {/* Transaction Details */}
                <div className="col-span-3 border-b border-gray-200 pb-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Transaction Details</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Transaction Date</label>
                      <p className="text-gray-900">{formatDate(selectedOrder.transaction_date)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">State</label>
                      <p className="text-gray-900">{toUpperOrNA(selectedOrder.state)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Supplier Name</label>
                      <p className="text-gray-900">{selectedOrder.supplier_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Location</label>
                      <p className="text-gray-900">{selectedOrder.location || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Warehouse</label>
                      <p className="text-gray-900">{selectedOrder.warehouse_name || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Chamber No.</label>
                      <p className="text-gray-900">{selectedOrder.chamber_no || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Delivery Location</label>
                      <p className="text-gray-900">{selectedOrder.delivery_location || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Commodity Details */}
                <div className="col-span-3 border-b border-gray-200 pb-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Commodity Details</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Commodity</label>
                      <p className="text-gray-900 font-medium">{toUpperOrNA(selectedOrder.commodity)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Variety</label>
                      <p className="text-gray-900">{toUpperOrNA(selectedOrder.variety)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Gate Pass No.</label>
                      <p className="text-gray-900">{selectedOrder.gate_pass_no || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                {/* Vehicle & Weight Details */}
                <div className="col-span-3 border-b border-gray-200 pb-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Vehicle & Weight Details</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Vehicle No.</label>
                      <p className="text-gray-900 font-medium">{selectedOrder.vehicle_no}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Weight Slip No.</label>
                      <p className="text-gray-900">{selectedOrder.weight_slip_no || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">No. of Bags</label>
                      <p className="text-gray-900">{selectedOrder.no_of_bags || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Gross Weight (MT)</label>
                      <p className="text-gray-900">{selectedOrder.gross_weight_mt?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Tare Weight (MT)</label>
                      <p className="text-gray-900">{selectedOrder.tare_weight_mt?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Net Weight (MT)</label>
                      <p className="text-gray-900 font-semibold">{selectedOrder.net_weight_mt?.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Financial Details */}
                <div className="col-span-3 border-b border-gray-200 pb-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Financial Details</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Rate Per MT</label>
                      <p className="text-gray-900">{formatCurrency(selectedOrder.rate_per_mt)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Gross Amount</label>
                      <p className="text-gray-900 font-semibold">{formatCurrency(selectedOrder.gross_amount)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Total Deduction</label>
                      <p className="text-gray-900 text-red-600 font-semibold">
                        {formatCurrency(selectedOrder.total_deduction || 0)}
                      </p>
                    </div>
                    <div className="col-span-3">
                      <label className="text-sm font-medium text-gray-600">Net Amount</label>
                      <p className="text-gray-900 text-2xl font-bold text-green-600">
                        {formatCurrency(selectedOrder.net_amount)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quality Parameters */}
                {(selectedOrder.hlw_wheat || selectedOrder.moisture_moi || selectedOrder.bddi) && (
                  <div className="col-span-3 border-b border-gray-200 pb-4 mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Quality Parameters</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {selectedOrder.hlw_wheat && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-gray-600">HLW (Wheat)</label>
                            <p className="text-gray-900">{selectedOrder.hlw_wheat}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Excess HLW</label>
                            <p className="text-gray-900">{selectedOrder.excess_hlw || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Deduction (HLW) ₹</label>
                            <p className="text-gray-900">{formatCurrency(selectedOrder.deduction_amount_hlw || 0)}</p>
                          </div>
                        </>
                      )}
                      {selectedOrder.moisture_moi && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Moisture (MOI)</label>
                            <p className="text-gray-900">{selectedOrder.moisture_moi}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Excess Moisture</label>
                            <p className="text-gray-900">{selectedOrder.excess_moisture || 'N/A'}</p>
                          </div>
                        </>
                      )}
                      {selectedOrder.bddi && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-gray-600">BDDI</label>
                            <p className="text-gray-900">{selectedOrder.bddi}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Excess BDDI</label>
                            <p className="text-gray-900">{selectedOrder.excess_bddi || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">MOI+BDDI</label>
                            <p className="text-gray-900">{selectedOrder.moi_bddi || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Weight Deduction (KG)</label>
                            <p className="text-gray-900">{selectedOrder.weight_deduction_kg || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Deduction (MOI+BDDI) ₹</label>
                            <p className="text-gray-900">{formatCurrency(selectedOrder.deduction_amount_moi_bddi || 0)}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Other Deductions */}
                {selectedOrder.other_deductions && selectedOrder.other_deductions.length > 0 && (
                  <div className="col-span-3 border-b border-gray-200 pb-4 mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Other Deductions</h3>
                    <div className="space-y-3">
                      {selectedOrder.other_deductions.map((deduction, index) => (
                        <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-sm font-semibold text-gray-700">Deduction {index + 1}:</span>
                                <span className="text-lg font-bold text-red-600">{formatCurrency(deduction.amount)}</span>
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

                {/* Remarks */}
                {selectedOrder.remarks && (
                  <div className="col-span-3">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">Remarks</h3>
                    <p className="text-gray-900 bg-gray-50 p-4 rounded-lg">{selectedOrder.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
