import { useState, useEffect } from 'react';
import { FileText, TrendingUp, Package, Building, Filter, Search, Download, Calendar, Plus, Edit, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import CSVUpload from '../CSVUpload';
import SupplyTransactionForm from './SupplyTransactionForm';
import { usePopupContext } from '../../contexts/PopupContext';

interface SupplyTransaction {
  id: string;
  transaction_date: string;
  state: string;
  supplier_name: string;
  location: string;
  warehouse_name: string;
  chamber_no?: string;
  commodity: string;
  variety: string;
  gate_pass_no?: string;
  vehicle_no?: string;
  weight_slip_no?: string;
  gross_weight_mt?: number;
  tare_weight_mt?: number;
  no_of_bags?: number;
  net_weight_mt: number;
  rate_per_mt: number;
  gross_amount: number;
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
  other_deductions?: number[];
  net_amount: number;
  remarks?: string;
}

interface TransactionSummary {
  totalTransactions: number;
  totalNetAmount: number;
  totalNetWeight: number;
  totalBags: number;
  avgRate: number;
}

export default function SupplyTransactionsView() {
  const { showAlert, showConfirm } = usePopupContext();
  const [transactions, setTransactions] = useState<SupplyTransaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [commodityFilter, setCommodityFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Stats
  const [supplierStats, setSupplierStats] = useState<any[]>([]);
  const [commodityStats, setCommodityStats] = useState<any[]>([]);
  const [warehouseStats, setWarehouseStats] = useState<any[]>([]);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<SupplyTransaction | null>(null);
  
  useEffect(() => {
    loadTransactions();
    loadStats();
  }, [supplierFilter, commodityFilter, warehouseFilter, stateFilter, dateFrom, dateTo]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const session = await api.auth.getSession();
      const token = session.data.session?.access_token;

      const params = new URLSearchParams();
      if (supplierFilter !== 'all') params.append('supplier_name', supplierFilter);
      if (commodityFilter !== 'all') params.append('commodity', commodityFilter);
      if (warehouseFilter !== 'all') params.append('warehouse_name', warehouseFilter);
      if (stateFilter !== 'all') params.append('state', stateFilter);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/supply-transactions?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token || ''}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const session = await api.auth.getSession();
      const token = session.data.session?.access_token;

      const [supplierRes, commodityRes, warehouseRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/supply-transactions/stats/by-supplier`, {
          headers: { 'Authorization': `Bearer ${token || ''}` }
        }),
        fetch(`${import.meta.env.VITE_API_URL}/supply-transactions/stats/by-commodity`, {
          headers: { 'Authorization': `Bearer ${token || ''}` }
        }),
        fetch(`${import.meta.env.VITE_API_URL}/supply-transactions/stats/by-warehouse`, {
          headers: { 'Authorization': `Bearer ${token || ''}` }
        })
      ]);

      if (supplierRes.ok) {
        const data = await supplierRes.json();
        setSupplierStats(data);
      }
      if (commodityRes.ok) {
        const data = await commodityRes.json();
        setCommodityStats(data);
      }
      if (warehouseRes.ok) {
        const data = await warehouseRes.json();
        setWarehouseStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        t.supplier_name.toLowerCase().includes(searchLower) ||
        t.commodity.toLowerCase().includes(searchLower) ||
        t.variety.toLowerCase().includes(searchLower) ||
        t.warehouse_name.toLowerCase().includes(searchLower) ||
        t.vehicle_no?.toLowerCase().includes(searchLower) ||
        t.gate_pass_no?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const uniqueSuppliers = [...new Set(transactions.map(t => t.supplier_name))];
  const uniqueCommodities = [...new Set(transactions.map(t => t.commodity))];
  const uniqueWarehouses = [...new Set(transactions.map(t => t.warehouse_name))];
  const uniqueStates = [...new Set(transactions.map(t => t.state))];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleEdit = (transaction: SupplyTransaction) => {
    setEditingTransaction(transaction);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Transaction',
      message: 'Are you sure you want to delete this transaction?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    try {
      const session = await api.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(`${import.meta.env.VITE_API_URL}/supply-transactions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        loadTransactions();
        loadStats();
      } else {
        const errorData = await response.json().catch(() => ({}));
        await showAlert({
          title: 'Delete Failed',
          message: errorData.error || 'Failed to delete transaction',
          tone: 'danger',
        });
      }
    } catch (error) {
      console.error('Error deleting transaction:', error);
      await showAlert({
        title: 'Delete Failed',
        message: 'An error occurred while deleting the transaction',
        tone: 'danger',
      });
    }
  };

  const handleFormSuccess = () => {
    loadTransactions();
    loadStats();
    setShowForm(false);
    setEditingTransaction(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showForm && (
        <SupplyTransactionForm
          onClose={() => {
            setShowForm(false);
            setEditingTransaction(null);
          }}
          onSuccess={handleFormSuccess}
          initialData={editingTransaction || undefined}
        />
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Supply Transactions</h2>
          <p className="text-gray-600">Manage and track all supply transactions</p>
        </div>
        <div className="flex gap-3">
          <CSVUpload type="supply-transactions" onUploadSuccess={() => { loadTransactions(); loadStats(); }} />
          <button
            onClick={() => {
              setEditingTransaction(null);
              setShowForm(true);
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add New Transaction
          </button>
        </div>
      </div>
      
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-800">{summary.totalTransactions}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Net Amount</p>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(summary.totalNetAmount)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Weight (MT)</p>
                <p className="text-2xl font-bold text-gray-800">{summary.totalNetWeight.toFixed(2)}</p>
              </div>
              <Package className="w-8 h-8 text-orange-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bags</p>
                <p className="text-2xl font-bold text-gray-800">{summary.totalBags || 0}</p>
              </div>
              <Package className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Rate/MT</p>
                <p className="text-2xl font-bold text-gray-800">{formatCurrency(summary.avgRate)}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
        </div>
      )}

      {/* Stats by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Supplier */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-blue-600" />
            Top Suppliers
          </h3>
          <div className="space-y-3">
            {supplierStats.slice(0, 5).map((stat, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{stat.supplier_name}</p>
                  <p className="text-sm text-gray-600">{stat.count} transactions</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-800">{formatCurrency(stat.totalNetAmount)}</p>
                  <p className="text-xs text-gray-600">{stat.totalNetWeight.toFixed(2)} MT</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Commodity */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-green-600" />
            By Commodity
          </h3>
          <div className="space-y-3">
            {commodityStats.map((stat, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{stat.commodity}</p>
                  <p className="text-sm text-gray-600">{stat.variety} - {stat.count} transactions</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-800">{formatCurrency(stat.totalNetAmount)}</p>
                  <p className="text-xs text-gray-600">{stat.totalNetWeight.toFixed(2)} MT</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Warehouse */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-orange-600" />
            By Warehouse
          </h3>
          <div className="space-y-3">
            {warehouseStats.slice(0, 5).map((stat, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{stat.warehouse_name}</p>
                  <p className="text-sm text-gray-600">{stat.location} - {stat.count} transactions</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-800">{formatCurrency(stat.totalNetAmount)}</p>
                  <p className="text-xs text-gray-600">{stat.totalNetWeight.toFixed(2)} MT</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by supplier, commodity, warehouse, vehicle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Suppliers</option>
            {uniqueSuppliers.map(supplier => (
              <option key={supplier} value={supplier}>{supplier}</option>
            ))}
          </select>
          
          <select
            value={commodityFilter}
            onChange={(e) => setCommodityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Commodities</option>
            {uniqueCommodities.map(commodity => (
              <option key={commodity} value={commodity}>{commodity}</option>
            ))}
          </select>
          
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Warehouses</option>
            {uniqueWarehouses.map(warehouse => (
              <option key={warehouse} value={warehouse}>{warehouse}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="From Date"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="To Date"
            />
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Warehouse</th>
                <th className="px-4 py-3 text-left">Commodity</th>
                <th className="px-4 py-3 text-left">Variety</th>
                <th className="px-4 py-3 text-right">Net Weight (MT)</th>
                <th className="px-4 py-3 text-right">Bags</th>
                <th className="px-4 py-3 text-right">Rate/MT</th>
                <th className="px-4 py-3 text-right">Gross Amount</th>
                <th className="px-4 py-3 text-right">Deductions</th>
                <th className="px-4 py-3 text-right">Net Amount</th>
                <th className="px-4 py-3 text-left">Vehicle No.</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-8 text-center text-gray-500">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => {
                  const totalDeductions = (transaction.deduction_amount_hlw || 0) + 
                                         (transaction.deduction_amount_moi_bddi || 0);
                  
                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{formatDate(transaction.transaction_date)}</td>
                      <td className="px-4 py-3 font-medium">{transaction.supplier_name}</td>
                      <td className="px-4 py-3">{transaction.location}</td>
                      <td className="px-4 py-3">{transaction.warehouse_name}</td>
                      <td className="px-4 py-3">{transaction.commodity}</td>
                      <td className="px-4 py-3">{transaction.variety}</td>
                      <td className="px-4 py-3 text-right">{transaction.net_weight_mt.toFixed(3)}</td>
                      <td className="px-4 py-3 text-right">{transaction.no_of_bags || '-'}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(transaction.rate_per_mt)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(transaction.gross_amount)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{formatCurrency(totalDeductions)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(transaction.net_amount)}</td>
                      <td className="px-4 py-3">{transaction.vehicle_no || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(transaction)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(transaction.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
