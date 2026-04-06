import { useState, useMemo, useEffect } from 'react';
import { Eye, Filter, X, Download, Edit, Trash2, FileDown } from 'lucide-react';
import { generateOrderPDF } from '../../utils/pdfGenerator';

interface ConfirmedSalesOrder {
  id: string;
  invoice_number: string;
  transaction_date: string;
  customer_id: {
    id: string;
    name: string;
    email: string;
    mobile_number?: string;
  };
  commodity: string;
  variety?: string;
  vehicle_no: string;
  net_weight_mt: number;
  rate_per_mt: number;
  gross_amount: number;
  total_deduction: number;
  net_amount: number;
  state?: string;
  seller_name?: string;
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
  bdoi?: number;
  excess_bdoi?: number;
  moi_bdoi?: number;
  weight_deduction_kg?: number;
  deduction_amount_moi_bdoi?: number;
  other_deductions?: Array<{ amount: number; remarks: string }>;
  quality_report?: Record<string, any>;
  delivery_location?: string;
  remarks?: string;
  created_by?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt?: string;
  approval_status?: 'pending' | 'approved' | 'declined';
  declined_reason?: string;
}

interface ConfirmedPurchaseOrder {
  id: string;
  invoice_number: string;
  transaction_date: string;
  customer_id: {
    id: string;
    name: string;
    email: string;
    mobile_number?: string;
  };
  commodity: string;
  variety?: string;
  vehicle_no: string;
  net_weight_mt: number;
  rate_per_mt: number;
  gross_amount: number;
  total_deduction: number;
  net_amount: number;
  state?: string;
  supplier_name?: string; // Different from seller_name
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
  bddi?: number; // Different from bdoi
  excess_bddi?: number;
  moi_bddi?: number;
  weight_deduction_kg?: number;
  deduction_amount_moi_bddi?: number;
  other_deductions?: Array<{ amount: number; remarks: string }>;
  quality_report?: Record<string, any>;
  delivery_location?: string;
  remarks?: string;
  created_by?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt?: string;
  approval_status?: 'pending' | 'approved' | 'declined';
  declined_reason?: string;
}

type ConfirmedOrder = (ConfirmedSalesOrder & { orderType: 'sales' }) | (ConfirmedPurchaseOrder & { orderType: 'purchase' });
type ColumnFilterKey =
  | 'orderType'
  | 'date'
  | 'party'
  | 'commodity'
  | 'vehicle'
  | 'netWeight'
  | 'netAmount'
  | 'approval';
type ColumnFilterState = Record<ColumnFilterKey, string>;

const DEFAULT_COLUMN_FILTERS: ColumnFilterState = {
  orderType: '',
  date: '',
  party: '',
  commodity: '',
  vehicle: '',
  netWeight: '',
  netAmount: '',
  approval: '',
};

interface AllConfirmedOrdersProps {
  currentUserRole?: string;
  dataVersion?: number;
}

const getApprovalBadgeClass = (status?: string) => {
  if (status === 'approved') return 'bg-green-100 text-green-800';
  if (status === 'declined') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
};

const getApprovalLabel = (status?: string) => {
  if (status === 'approved') return 'APPROVED';
  if (status === 'declined') return 'REJECTED';
  return 'PENDING';
};

export default function AllConfirmedOrders({ currentUserRole, dataVersion }: AllConfirmedOrdersProps) {
  const [salesOrders, setSalesOrders] = useState<ConfirmedSalesOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<ConfirmedPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<ConfirmedOrder | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'sales' | 'purchase'>('all');
  const [columnFilters, setColumnFilters] = useState<ColumnFilterState>({ ...DEFAULT_COLUMN_FILTERS });
  const [editingOrder, setEditingOrder] = useState<ConfirmedOrder | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<ConfirmedOrder>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'sales' | 'purchase' } | null>(null);
  const [selectedOrderKeys, setSelectedOrderKeys] = useState<string[]>([]);
  const [singleDeclineOrder, setSingleDeclineOrder] = useState<ConfirmedOrder | null>(null);
  const [singleDeclineReason, setSingleDeclineReason] = useState('');
  const [bulkDecisionOpen, setBulkDecisionOpen] = useState(false);
  const [bulkDeclineReason, setBulkDeclineReason] = useState('');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  const fetchOrders = async ({ silent } = { silent: false }) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setError('Authentication required');
        return;
      }

      const [salesRes, purchaseRes] = await Promise.all([
        fetch(`${apiUrl}/confirmed-sales-orders`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${apiUrl}/confirmed-purchase-orders`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      if (!salesRes.ok || !purchaseRes.ok) {
        throw new Error('Failed to fetch confirmed orders');
      }

      const salesData = await salesRes.json();
      const purchaseData = await purchaseRes.json();

      setSalesOrders(salesData);
      setPurchaseOrders(purchaseData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Refresh only when dataVersion changes (from AdminPanel’s version polling)
  useEffect(() => {
    if (dataVersion === undefined || dataVersion === null) return;
    void fetchOrders({ silent: true });
  }, [dataVersion]);

  function formatDate(dateString?: string) {
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
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(amount);
  }

  const toUpperText = (value?: string | null) => String(value ?? '').trim().toUpperCase();
  const toUpperOrNA = (value?: string | null) => {
    const normalized = toUpperText(value);
    return normalized || 'N/A';
  };

  const getOrderTypeLabel = (order: ConfirmedOrder) =>
    order.orderType === 'sales' ? 'Sales Order' : 'Purchase Order';

  const getOrderKey = (order: ConfirmedOrder) => `${order.orderType}:${order.id}`;

  const getPartyLabel = (order: ConfirmedOrder) =>
    order.orderType === 'purchase'
      ? (order.supplier_name || order.customer_id?.name || 'N/A')
      : (order.seller_name || order.customer_id?.name || 'N/A');

  const getCommodityLabel = (order: ConfirmedOrder) =>
    `${toUpperText(order.commodity)}${toUpperText(order.variety) ? ` (${toUpperText(order.variety)})` : ''}`;

  const getVehicleLabel = (order: ConfirmedOrder) => order.vehicle_no || 'N/A';

  const getNetWeightLabel = (order: ConfirmedOrder) =>
    `${order.net_weight_mt?.toFixed(2)} MT`;

  const getNetAmountLabel = (order: ConfirmedOrder) =>
    formatCurrency(order.net_amount);

  const handleExportToCSV = () => {
    try {
      // Helper functions for CSV export (different from display formatting)
      const exportFormatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '';
        try {
          const date = new Date(dateStr);
          if (isNaN(date.getTime())) return dateStr;
          return date.toLocaleDateString('en-GB');
        } catch {
          return dateStr;
        }
      };

      const exportFormatCurrency = (amount: number | undefined) => {
        if (amount === undefined || amount === null) return '0.0000';
        return amount.toFixed(4);
      };

      const ordersToExport = filteredOrders;
      
      if (ordersToExport.length === 0) {
        setError('No orders to export');
        return;
      }

      // Separate sales and purchase orders
      const salesOrdersToExport = ordersToExport.filter(o => o.orderType === 'sales') as ConfirmedSalesOrder[];
      const purchaseOrdersToExport = ordersToExport.filter(o => o.orderType === 'purchase') as ConfirmedPurchaseOrder[];

      let csvContent = '';
      let filename = '';

      // Export Purchase Orders (39 columns - no separate remarks for other deductions)
      if (purchaseOrdersToExport.length > 0) {
        const purchaseHeaders = [
          'Date of Transaction',
          'State',
          'Supplier Name',
          'Location',
          'Warehouse Name',
          'Chamber No.',
          'Commodity',
          'Variety',
          'Gate Pass No.',
          'Vehicle No.',
          'Weight Slip No.',
          'Gross Weight in MT (Vehicle + Goods)',
          'Tare Weight of Vehicle',
          'No. of Bags',
          'Net Weight in MT',
          'Rate Per MT',
          'Gross Amount',
          'HLW (Hectolitre Weight) in Wheat',
          'Excess HLW',
          'Deduction Amount Rs. (HLW)',
          'Moisture (MOI)',
          'Excess Moisture',
          'Broken, Damage, Discolour, Immature (BDDI)',
          'Excess BDDI',
          'MOI+BDDI',
          'Weight Deduction in KG',
          'Deduction Amount Rs. (MOI+BDDI)',
          'Other Deduction 1',
          'Other Deduction 2',
          'Other Deduction 3',
          'Other Deduction 4',
          'Other Deduction 5',
          'Other Deduction 6',
          'Other Deduction 7',
          'Other Deduction 8',
          'Other Deduction 9',
          'Other Deduction 10',
          'Net Amount',
          'Remarks'
        ];

        const purchaseRows = purchaseOrdersToExport.map(order => {
          // Get other deductions (up to 10)
          const otherDeductions = order.other_deductions || [];
          const deductionValues = Array(10).fill('-').map((_, idx) => {
            if (otherDeductions[idx]) {
              return formatCurrency(otherDeductions[idx].amount);
            }
            return '-';
          });

          return [
            formatDate(order.transaction_date),
            toUpperText(order.state),
            order.supplier_name || order.customer_id?.name || '',
            order.location || '',
            order.warehouse_name || '',
            order.chamber_no || '',
            toUpperText(order.commodity),
            toUpperText(order.variety),
            order.gate_pass_no || '',
            order.vehicle_no || '',
            order.weight_slip_no || '',
            exportFormatCurrency(order.gross_weight_mt),
            exportFormatCurrency(order.tare_weight_mt),
            (order.no_of_bags || 0).toString(),
            exportFormatCurrency(order.net_weight_mt),
            exportFormatCurrency(order.rate_per_mt),
            exportFormatCurrency(order.gross_amount),
            exportFormatCurrency(order.hlw_wheat) || 'Not Applicable',
            exportFormatCurrency(order.excess_hlw) || 'Not Applicable',
            exportFormatCurrency(order.deduction_amount_hlw) || '0.00',
            exportFormatCurrency(order.moisture_moi) || '',
            exportFormatCurrency(order.excess_moisture) || '',
            exportFormatCurrency(order.bddi) || '',
            exportFormatCurrency(order.excess_bddi) || '',
            exportFormatCurrency(order.moi_bddi) || '',
            exportFormatCurrency(order.weight_deduction_kg) || '',
            exportFormatCurrency(order.deduction_amount_moi_bddi) || '',
            ...deductionValues,
            exportFormatCurrency(order.net_amount),
            order.remarks || ''
          ];
        });

        csvContent = [purchaseHeaders, ...purchaseRows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');
        
        filename = filterType === 'all' 
          ? `all_confirmed_orders_${new Date().toISOString().split('T')[0]}.csv`
          : `confirmed_purchase_orders_${new Date().toISOString().split('T')[0]}.csv`;
      }

      // Export Sales Orders (with separate remarks columns for other deductions)
      if (salesOrdersToExport.length > 0) {
        const salesHeaders = [
          'Date of Transaction',
          'State',
          'Customer',
          'Seller Name',
          'Location',
          'Warehouse Name',
          'Chamber No.',
          'Commodity',
          'Variety',
          'Gate Pass No.',
          'Vehicle No.',
          'Weight Slip No.',
          'Gross Weight in MT (Vehicle + Goods)',
          'Tare Weight of Vehicle',
          'No. of Bags',
          'Net Weight in MT',
          'Rate Per MT',
          'Gross Amount',
          'HLW (Hectolitre Weight) in Wheat',
          'Excess HLW',
          'Deduction Amount Rs. (HLW)',
          'Moisture (MOI)',
          'Excess Moisture',
          'Broken, Damage, Discolour, Immature (BDOI)',
          'Excess BDOI',
          'MOI+BDOI',
          'Weight Deduction in KG (MOI+BDOI)',
          'Deduction Amount Rs. (MOI+BDOI)',
          'Other Deduction 1',
          'Other Deduction 1 Remarks',
          'Other Deduction 2',
          'Other Deduction 2 Remarks',
          'Other Deduction 3',
          'Other Deduction 3 Remarks',
          'Other Deduction 4',
          'Other Deduction 4 Remarks',
          'Other Deduction 5',
          'Other Deduction 5 Remarks',
          'Other Deduction 6',
          'Other Deduction 6 Remarks',
          'Other Deduction 7',
          'Other Deduction 7 Remarks',
          'Other Deduction 8',
          'Other Deduction 8 Remarks',
          'Other Deduction 9',
          'Other Deduction 9 Remarks',
          'Net Amount',
          'Remarks'
        ];

        const salesRows = salesOrdersToExport.map(order => {
          // Get other deductions (up to 9) with remarks
          const otherDeductions = order.other_deductions || [];
          const deductionPairs = Array(9).fill(null).map((_, idx) => {
            if (otherDeductions[idx]) {
              return [
                exportFormatCurrency(otherDeductions[idx].amount),
                otherDeductions[idx].remarks || ''
              ];
            }
            return ['-', '-'];
          }).flat();

          return [
            exportFormatDate(order.transaction_date),
            toUpperText(order.state),
            order.customer_id?.name || '',
            order.seller_name || order.customer_id?.name || '',
            order.location || '',
            order.warehouse_name || '',
            order.chamber_no || '',
            toUpperText(order.commodity),
            toUpperText(order.variety),
            order.gate_pass_no || '',
            order.vehicle_no || '',
            order.weight_slip_no || '',
            exportFormatCurrency(order.gross_weight_mt),
            exportFormatCurrency(order.tare_weight_mt),
            (order.no_of_bags || 0).toString(),
            exportFormatCurrency(order.net_weight_mt),
            exportFormatCurrency(order.rate_per_mt),
            exportFormatCurrency(order.gross_amount),
            exportFormatCurrency(order.hlw_wheat) || 'Not Applicable',
            exportFormatCurrency(order.excess_hlw) || 'Not Applicable',
            exportFormatCurrency(order.deduction_amount_hlw) || '0.00',
            exportFormatCurrency(order.moisture_moi) || '',
            exportFormatCurrency(order.excess_moisture) || '',
            exportFormatCurrency(order.bdoi) || '',
            exportFormatCurrency(order.excess_bdoi) || '',
            exportFormatCurrency(order.moi_bdoi) || '',
            exportFormatCurrency(order.weight_deduction_kg) || '',
            exportFormatCurrency(order.deduction_amount_moi_bdoi) || '',
            ...deductionPairs,
            exportFormatCurrency(order.net_amount),
            order.remarks || ''
          ];
        });

        if (csvContent) {
          // If we already have purchase orders, add sales orders to the same file
          csvContent += '\n\n'; // Add separator
          csvContent += [salesHeaders, ...salesRows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
          filename = `all_confirmed_orders_${new Date().toISOString().split('T')[0]}.csv`;
        } else {
          csvContent = [salesHeaders, ...salesRows]
            .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
          filename = `confirmed_sales_orders_${new Date().toISOString().split('T')[0]}.csv`;
        }
      }

      // Download the CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Export error:', error);
      setError('Failed to export orders: ' + (error.message || 'Unknown error'));
    }
  };

  const allOrders: ConfirmedOrder[] = useMemo(
    () =>
      [
        ...salesOrders.map(order => ({ ...order, orderType: 'sales' as const })),
        ...purchaseOrders.map(order => ({ ...order, orderType: 'purchase' as const })),
      ].sort((a, b) => {
        const dateA = new Date(a.transaction_date || a.createdAt || 0).getTime();
        const dateB = new Date(b.transaction_date || b.createdAt || 0).getTime();
        return dateB - dateA;
      }),
    [salesOrders, purchaseOrders]
  );

  const typeFilteredOrders = useMemo(
    () => (filterType === 'all' ? allOrders : allOrders.filter(order => order.orderType === filterType)),
    [allOrders, filterType]
  );

  const columnFilterOptions = useMemo(() => {
    const collect = (picker: (order: ConfirmedOrder) => string) =>
      Array.from(new Set(typeFilteredOrders.map(picker))).filter(Boolean).sort((a, b) => a.localeCompare(b));

    return {
      orderType: collect(getOrderTypeLabel),
      date: collect((order) => formatDate(order.transaction_date)),
      party: collect(getPartyLabel),
      commodity: collect(getCommodityLabel),
      vehicle: collect(getVehicleLabel),
      netWeight: collect(getNetWeightLabel),
      netAmount: collect(getNetAmountLabel),
      approval: collect((order) => getApprovalLabel(order.approval_status)),
    };
  }, [
    typeFilteredOrders,
    getOrderTypeLabel,
    formatDate,
    getPartyLabel,
    getCommodityLabel,
    getVehicleLabel,
    getNetWeightLabel,
    getNetAmountLabel,
    getApprovalLabel,
  ]);

  const filteredOrders = useMemo(
    () =>
      typeFilteredOrders.filter((order) => {
        if (columnFilters.orderType && getOrderTypeLabel(order) !== columnFilters.orderType) return false;
        if (columnFilters.date && formatDate(order.transaction_date) !== columnFilters.date) return false;
        if (columnFilters.party && getPartyLabel(order) !== columnFilters.party) return false;
        if (columnFilters.commodity && getCommodityLabel(order) !== columnFilters.commodity) return false;
        if (columnFilters.vehicle && getVehicleLabel(order) !== columnFilters.vehicle) return false;
        if (columnFilters.netWeight && getNetWeightLabel(order) !== columnFilters.netWeight) return false;
        if (columnFilters.netAmount && getNetAmountLabel(order) !== columnFilters.netAmount) return false;
        if (columnFilters.approval && getApprovalLabel(order.approval_status) !== columnFilters.approval) return false;
        return true;
      }),
    [
      typeFilteredOrders,
      columnFilters,
      getOrderTypeLabel,
      formatDate,
      getPartyLabel,
      getCommodityLabel,
      getVehicleLabel,
      getNetWeightLabel,
      getNetAmountLabel,
      getApprovalLabel,
    ]
  );

  const handleColumnFilterChange = (key: ColumnFilterKey, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

  const isSuperAdmin = currentUserRole === 'super_admin';

  const pendingQueueOrders = useMemo(
    () => typeFilteredOrders.filter((order) => order.approval_status === 'pending'),
    [typeFilteredOrders]
  );

  const pendingQueueOrderKeys = useMemo(
    () => pendingQueueOrders.map((order) => getOrderKey(order)),
    [pendingQueueOrders]
  );

  const reviewedOrders = useMemo(
    () => (isSuperAdmin ? filteredOrders.filter((order) => order.approval_status !== 'pending') : filteredOrders),
    [isSuperAdmin, filteredOrders]
  );

  const approvedCount = typeFilteredOrders.filter((order) => order.approval_status === 'approved').length;
  const rejectedCount = typeFilteredOrders.filter((order) => order.approval_status === 'declined').length;
  const pendingCount = pendingQueueOrders.length;

  const selectedPendingCount = selectedOrderKeys.length;
  const allVisiblePendingSelected =
    pendingQueueOrderKeys.length > 0 &&
    selectedPendingCount === pendingQueueOrderKeys.length;
  const bulkRejectCount = Math.max(pendingQueueOrders.length - selectedPendingCount, 0);

  // Initial load with spinner
  useEffect(() => {
    void fetchOrders();
  }, []);

  useEffect(() => {
    const pendingSet = new Set(pendingQueueOrderKeys);
    setSelectedOrderKeys((prev) => {
      const next = prev.filter((key) => pendingSet.has(key));
      if (next.length === prev.length && next.every((key, index) => key === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [pendingQueueOrderKeys]);

  const toggleOrderSelection = (order: ConfirmedOrder, checked: boolean) => {
    const key = getOrderKey(order);
    setSelectedOrderKeys((prev) => {
      if (checked) {
        if (prev.includes(key)) return prev;
        return [...prev, key];
      }
      return prev.filter((existing) => existing !== key);
    });
  };

  const toggleSelectAllPending = (checked: boolean) => {
    setSelectedOrderKeys(checked ? [...pendingQueueOrderKeys] : []);
  };

  const updateOrderApproval = async (
    order: ConfirmedOrder,
    status: 'approved' | 'declined',
    reason = ''
  ) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication required');
    }

    const endpoint = order.orderType === 'sales'
      ? `${apiUrl}/confirmed-sales-orders/${order.id}/approval`
      : `${apiUrl}/confirmed-purchase-orders/${order.id}/approval`;

    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, reason })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update approval');
    }
  };

  const handleDelete = async (orderId: string, orderType: 'sales' | 'purchase') => {
    try {
      setLoading(true);
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setError('Authentication required');
        return;
      }

      const endpoint = orderType === 'sales' 
        ? `${apiUrl}/confirmed-sales-orders/${orderId}`
        : `${apiUrl}/confirmed-purchase-orders/${orderId}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete order');
      }

      // Refresh orders
      await fetchOrders();
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOrderApproval = async (
    order: ConfirmedOrder,
    status: 'approved' | 'declined',
    reason = ''
  ) => {
    try {
      const trimmedReason = reason.trim();
      if (status === 'declined' && !trimmedReason) {
        setError('Decline reason is required');
        return false;
      }
      setApprovalSubmitting(true);
      setError('');
      await updateOrderApproval(order, status, trimmedReason);
      await fetchOrders();
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to update approval');
      return false;
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const openSingleDeclineModal = (order: ConfirmedOrder) => {
    setSingleDeclineOrder(order);
    setSingleDeclineReason('');
  };

  const closeSingleDeclineModal = () => {
    if (approvalSubmitting) return;
    setSingleDeclineOrder(null);
    setSingleDeclineReason('');
  };

  const submitSingleDecline = async () => {
    if (!singleDeclineOrder) return;
    const success = await handleOrderApproval(singleDeclineOrder, 'declined', singleDeclineReason);
    if (success) {
      closeSingleDeclineModal();
    }
  };

  const openBulkDecisionModal = () => {
    if (pendingQueueOrders.length === 0) {
      setError('No pending orders available for bulk approval decision.');
      return;
    }
    setBulkDecisionOpen(true);
    setBulkDeclineReason('');
  };

  const closeBulkDecisionModal = () => {
    if (approvalSubmitting) return;
    setBulkDecisionOpen(false);
    setBulkDeclineReason('');
  };

  const submitBulkDecision = async () => {
    const selectedSet = new Set(selectedOrderKeys);
    const approveOrders = pendingQueueOrders.filter((order) => selectedSet.has(getOrderKey(order)));
    const rejectOrders = pendingQueueOrders.filter((order) => !selectedSet.has(getOrderKey(order)));
    const commonReason = bulkDeclineReason.trim();

    if (rejectOrders.length > 0 && !commonReason) {
      setError('Bulk rejection reason is required for non-selected orders.');
      return;
    }

    const tasks = [
      ...approveOrders.map((order) => ({ order, status: 'approved' as const, reason: '' })),
      ...rejectOrders.map((order) => ({ order, status: 'declined' as const, reason: commonReason })),
    ];

    if (tasks.length === 0) {
      setError('No pending orders available for bulk approval decision.');
      return;
    }

    try {
      setApprovalSubmitting(true);
      setError('');

      const settled = await Promise.allSettled(
        tasks.map((task) => updateOrderApproval(task.order, task.status, task.reason))
      );

      const failures = settled
        .map((result, index) => {
          if (result.status === 'fulfilled') return '';
          const task = tasks[index];
          const invoice = task.order.invoice_number || task.order.id;
          return `${task.order.orderType.toUpperCase()} ${invoice}: ${result.reason?.message || 'Failed'}`;
        })
        .filter(Boolean);

      if (failures.length > 0) {
        setError(`Bulk decision completed with ${failures.length} failed update(s). ${failures.slice(0, 2).join(' | ')}`);
      }

      await fetchOrders();
      setSelectedOrderKeys([]);
      setBulkDecisionOpen(false);
      setBulkDeclineReason('');
    } catch (err: any) {
      setError(err.message || 'Failed to apply bulk approval decision');
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handleEdit = (order: ConfirmedOrder) => {
    setEditingOrder(order);
    setSelectedOrder(null);
    setEditFormData({
      transaction_date: order.transaction_date,
      state: order.state,
      location: order.location,
      warehouse_name: order.warehouse_name,
      chamber_no: order.chamber_no,
      gate_pass_no: order.gate_pass_no,
      weight_slip_no: order.weight_slip_no,
      delivery_location: order.delivery_location,
      commodity: order.commodity,
      variety: order.variety,
      vehicle_no: order.vehicle_no,
      gross_weight_mt: (order as any).gross_weight_mt,
      tare_weight_mt: (order as any).tare_weight_mt,
      no_of_bags: (order as any).no_of_bags,
      net_weight_mt: order.net_weight_mt,
      rate_per_mt: order.rate_per_mt,
      gross_amount: order.gross_amount,
      hlw_wheat: (order as any).hlw_wheat,
      excess_hlw: (order as any).excess_hlw,
      deduction_amount_hlw: (order as any).deduction_amount_hlw,
      moisture_moi: (order as any).moisture_moi,
      excess_moisture: (order as any).excess_moisture,
      bdoi: (order as any).bdoi,
      excess_bdoi: (order as any).excess_bdoi,
      moi_bdoi: (order as any).moi_bdoi,
      bddi: (order as any).bddi,
      excess_bddi: (order as any).excess_bddi,
      moi_bddi: (order as any).moi_bddi,
      weight_deduction_kg: (order as any).weight_deduction_kg,
      deduction_amount_moi_bdoi: (order as any).deduction_amount_moi_bdoi || (order as any).deduction_amount_moi_bddi,
      other_deductions: (order as any).other_deductions,
      net_amount: order.net_amount,
      remarks: order.remarks,
      approval_status: order.approval_status,
      declined_reason: order.declined_reason,
      seller_name: (order as ConfirmedSalesOrder).seller_name,
      supplier_name: (order as ConfirmedPurchaseOrder).supplier_name,
    });
  };

  const submitEdit = async () => {
    if (!editingOrder) return;
    try {
      setEditSaving(true);
      setError('');
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const endpoint = editingOrder.orderType === 'sales'
        ? `${apiUrl}/confirmed-sales-orders/${editingOrder.id}`
        : `${apiUrl}/confirmed-purchase-orders/${editingOrder.id}`;

      const payload: any = {
        transaction_date: editFormData.transaction_date,
        state: editFormData.state,
        location: editFormData.location,
        warehouse_name: editFormData.warehouse_name,
        chamber_no: editFormData.chamber_no,
        gate_pass_no: editFormData.gate_pass_no,
        weight_slip_no: editFormData.weight_slip_no,
        delivery_location: editFormData.delivery_location,
        commodity: editFormData.commodity,
        variety: editFormData.variety,
        vehicle_no: editFormData.vehicle_no,
        gross_weight_mt: editFormData.gross_weight_mt,
        tare_weight_mt: editFormData.tare_weight_mt,
        no_of_bags: editFormData.no_of_bags,
        net_weight_mt: editFormData.net_weight_mt,
        rate_per_mt: editFormData.rate_per_mt,
        gross_amount: editFormData.gross_amount,
        hlw_wheat: editFormData.hlw_wheat,
        excess_hlw: editFormData.excess_hlw,
        deduction_amount_hlw: editFormData.deduction_amount_hlw,
        moisture_moi: editFormData.moisture_moi,
        excess_moisture: editFormData.excess_moisture,
        bdoi: editFormData.bdoi,
        excess_bdoi: editFormData.excess_bdoi,
        moi_bdoi: editFormData.moi_bdoi,
        bddi: editFormData.bddi,
        excess_bddi: editFormData.excess_bddi,
        moi_bddi: editFormData.moi_bddi,
        weight_deduction_kg: editFormData.weight_deduction_kg,
        deduction_amount_moi_bdoi: editFormData.deduction_amount_moi_bdoi,
        other_deductions: editFormData.other_deductions,
        net_amount: editFormData.net_amount,
        remarks: editFormData.remarks,
        approval_status: editFormData.approval_status,
        declined_reason: editFormData.declined_reason,
      };

      if (editingOrder.orderType === 'sales') {
        payload.seller_name = editFormData.seller_name || editingOrder.customer_id?.name;
      } else {
        payload.supplier_name = editFormData.supplier_name || editingOrder.customer_id?.name;
      }

      if (editFormData.deduction_amount_hlw !== undefined) {
        payload.deduction_amount_hlw = Number(editFormData.deduction_amount_hlw);
      }
      if (editFormData.deduction_amount_moi_bdoi !== undefined) {
        payload.deduction_amount_moi_bdoi = Number(editFormData.deduction_amount_moi_bdoi);
      }

      await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      await fetchOrders({ silent: true });
      setEditingOrder(null);
      setEditFormData({});
    } catch (err: any) {
      setError(err?.message || 'Failed to update order');
    } finally {
      setEditSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading confirmed orders...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-800 p-4 flex items-start justify-between gap-4">
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError('')}
            className="text-red-700 hover:text-red-900"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">All Confirmed Orders</h1>
          <p className="text-gray-600">View all confirmed sales and purchase orders</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExportToCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            title="Download all orders as CSV/Excel"
          >
            <FileDown className="w-5 h-5" />
            Download {filterType === 'all' ? 'All Orders' : filterType === 'sales' ? 'Sales Orders' : 'Purchase Orders'} (CSV/Excel)
          </button>
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-300 p-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | 'sales' | 'purchase')}
              className="border-none outline-none text-sm font-medium"
            >
              <option value="all">All Orders</option>
              <option value="sales">Sales Orders</option>
              <option value="purchase">Purchase Orders</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Total Orders (View)</p>
          <p className="text-2xl font-bold text-blue-900 mt-1">{typeFilteredOrders.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Pending</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{pendingCount}</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Approved</p>
          <p className="text-2xl font-bold text-green-900 mt-1">{approvedCount}</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">Rejected</p>
          <p className="text-2xl font-bold text-red-900 mt-1">{rejectedCount}</p>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-sm">
          <div className="px-5 py-4 border-b border-amber-200 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-amber-900">Pending Review Queue</h2>
              <p className="text-sm text-amber-800">
                Approve selected rows. Unselected pending rows will be rejected in one bulk action.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleSelectAllPending(true)}
                disabled={pendingQueueOrders.length === 0 || allVisiblePendingSelected}
                className="px-3 py-1.5 rounded-md border border-amber-300 text-amber-900 bg-white hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
              >
                Select All Pending
              </button>
              <button
                onClick={() => toggleSelectAllPending(false)}
                disabled={selectedPendingCount === 0}
                className="px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
              >
                Clear
              </button>
              <button
                onClick={openBulkDecisionModal}
                disabled={pendingQueueOrders.length === 0 || approvalSubmitting}
                className="px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold"
              >
                Apply Bulk Decision
              </button>
            </div>
          </div>
          <div className="px-5 py-3 bg-amber-100/50 border-b border-amber-200 text-sm text-amber-900">
            Pending: <span className="font-semibold">{pendingQueueOrders.length}</span> | Selected for approve: <span className="font-semibold">{selectedPendingCount}</span> | Will reject: <span className="font-semibold">{bulkRejectCount}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white border-b border-amber-200">
                <tr>
                  <th className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allVisiblePendingSelected}
                      onChange={(e) => toggleSelectAllPending(e.target.checked)}
                      disabled={pendingQueueOrderKeys.length === 0}
                      className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Order Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Supplier / Seller</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Commodity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Net Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {pendingQueueOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-gray-500">No pending orders in this view.</td>
                  </tr>
                ) : (
                  pendingQueueOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedOrderKeys.includes(getOrderKey(order))}
                          onChange={(e) => toggleOrderSelection(order, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          order.orderType === 'sales' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {getOrderTypeLabel(order)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatDate(order.transaction_date)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="font-medium">{getPartyLabel(order)}</div>
                        <div className="text-xs text-gray-500">{order.customer_id?.email || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{getCommodityLabel(order)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{getVehicleLabel(order)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900">{getNetAmountLabel(order)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleOrderApproval(order, 'approved')}
                            disabled={approvalSubmitting}
                            className="text-green-600 hover:text-green-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Approve"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => openSingleDeclineModal(order)}
                            disabled={approvalSubmitting}
                            className="text-amber-600 hover:text-amber-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Decline"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isSuperAdmin ? 'Reviewed Confirmed Orders' : 'All Confirmed Orders'}
          </h2>
          <p className="text-xs text-gray-500">
            {isSuperAdmin ? 'Approved and Rejected records' : 'All statuses'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Order Type</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Supplier / Seller</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Commodity</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Vehicle No.</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Net Weight (MT)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Net Amount</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Approval</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
              <tr className="bg-gray-100 border-t border-gray-200">
                <th className="px-4 py-2">
                  <select
                    value={columnFilters.orderType}
                    onChange={(e) => handleColumnFilterChange('orderType', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {columnFilterOptions.orderType.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2">
                  <select
                    value={columnFilters.date}
                    onChange={(e) => handleColumnFilterChange('date', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {columnFilterOptions.date.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2">
                  <select
                    value={columnFilters.party}
                    onChange={(e) => handleColumnFilterChange('party', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {columnFilterOptions.party.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2">
                  <select
                    value={columnFilters.commodity}
                    onChange={(e) => handleColumnFilterChange('commodity', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {columnFilterOptions.commodity.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2">
                  <select
                    value={columnFilters.vehicle}
                    onChange={(e) => handleColumnFilterChange('vehicle', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {columnFilterOptions.vehicle.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2">
                  <select
                    value={columnFilters.netWeight}
                    onChange={(e) => handleColumnFilterChange('netWeight', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {columnFilterOptions.netWeight.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2">
                  <select
                    value={columnFilters.netAmount}
                    onChange={(e) => handleColumnFilterChange('netAmount', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {columnFilterOptions.netAmount.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2">
                  <select
                    value={columnFilters.approval}
                    onChange={(e) => handleColumnFilterChange('approval', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-green-500 focus:outline-none"
                  >
                    <option value="">All</option>
                    {columnFilterOptions.approval.map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </th>
                <th className="px-4 py-2 text-right">
                  <button
                    onClick={() => setColumnFilters({ ...DEFAULT_COLUMN_FILTERS })}
                    className="text-xs font-medium text-green-700 hover:text-green-900"
                    title="Clear all column filters"
                  >
                    Clear Filters
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reviewedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    {isSuperAdmin ? 'No reviewed orders found in this filter.' : 'No confirmed orders found'}
                  </td>
                </tr>
              ) : (
                reviewedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.orderType === 'sales'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {getOrderTypeLabel(order)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(order.transaction_date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      <div>
                        <div className="font-medium">{getPartyLabel(order)}</div>
                        <div className="text-xs text-gray-500">{order.customer_id?.email || ''}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{getCommodityLabel(order)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{getVehicleLabel(order)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{getNetWeightLabel(order)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{getNetAmountLabel(order)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex flex-col gap-1">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full w-fit ${getApprovalBadgeClass(order.approval_status)}`}>
                          {getApprovalLabel(order.approval_status)}
                        </span>
                        {order.approval_status === 'declined' && order.declined_reason && (
                          <span className="text-xs text-red-700 max-w-xs truncate" title={order.declined_reason}>
                            {order.declined_reason}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        {isSuperAdmin && order.approval_status === 'pending' && (
                          <button
                            onClick={() => handleOrderApproval(order, 'approved')}
                            disabled={approvalSubmitting}
                            className="text-green-600 hover:text-green-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Approve"
                          >
                            Approve
                          </button>
                        )}
                        {isSuperAdmin && order.approval_status === 'pending' && (
                          <button
                            onClick={() => openSingleDeclineModal(order)}
                            disabled={approvalSubmitting}
                            className="text-amber-600 hover:text-amber-800 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Decline"
                          >
                            Reject
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        <button
                          onClick={() => handleEdit(order)}
                          disabled={currentUserRole === 'admin' && order.approval_status === 'approved'}
                          className="text-green-600 hover:text-green-800 font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={currentUserRole === 'admin' && order.approval_status === 'approved' ? 'Approved order cannot be edited by Admin' : 'Edit Order'}
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ id: order.id, type: order.orderType })}
                          disabled={currentUserRole === 'admin' && order.approval_status === 'approved'}
                          className="text-red-600 hover:text-red-800 font-medium flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={currentUserRole === 'admin' && order.approval_status === 'approved' ? 'Approved order cannot be deleted by Admin' : 'Delete Order'}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  Order Details
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    selectedOrder.orderType === 'sales'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {selectedOrder.orderType === 'sales' ? 'Sales Order' : 'Purchase Order'}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => generateOrderPDF(selectedOrder, selectedOrder.orderType)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
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
                {/* Customer Information */}
                <div className="col-span-3 border-b border-gray-200 pb-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    {selectedOrder.orderType === 'purchase' ? 'Supplier Information' : 'Customer Information'}
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        {selectedOrder.orderType === 'purchase' ? 'Supplier Name' : 'Customer Name'}
                      </label>
                      <p className="text-gray-900 font-medium">
                        {selectedOrder.orderType === 'purchase'
                          ? ((selectedOrder as ConfirmedPurchaseOrder).supplier_name || selectedOrder.customer_id?.name || 'N/A')
                          : ((selectedOrder as ConfirmedSalesOrder).seller_name || selectedOrder.customer_id?.name || 'N/A')
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Email</label>
                      <p className="text-gray-900">{selectedOrder.customer_id?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Mobile</label>
                      <p className="text-gray-900">{selectedOrder.customer_id?.mobile_number || 'N/A'}</p>
                    </div>
                  </div>
                </div>

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
                      <label className="text-sm font-medium text-gray-600">Approval Status</label>
                      <p className="text-gray-900">{getApprovalLabel(selectedOrder.approval_status)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">
                        {selectedOrder.orderType === 'sales' ? 'Seller Name' : 'Supplier Name'}
                      </label>
                      <p className="text-gray-900">
                        {selectedOrder.orderType === 'sales' 
                          ? (selectedOrder as ConfirmedSalesOrder).seller_name || 'N/A'
                          : (selectedOrder as ConfirmedPurchaseOrder).supplier_name || 'N/A'}
                      </p>
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
                {(selectedOrder.hlw_wheat || selectedOrder.moisture_moi || (selectedOrder as any).bdoi || (selectedOrder as any).bddi) && (
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
                      {((selectedOrder as any).bdoi || (selectedOrder as any).bddi) && (
                        <>
                          <div>
                            <label className="text-sm font-medium text-gray-600">
                              {selectedOrder.orderType === 'sales' ? 'BDOI' : 'BDDI'}
                            </label>
                            <p className="text-gray-900">
                              {selectedOrder.orderType === 'sales'
                                ? ((selectedOrder as any).bdoi || 'N/A')
                                : ((selectedOrder as any).bddi || 'N/A')}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">
                              Excess {selectedOrder.orderType === 'sales' ? 'BDOI' : 'BDDI'}
                            </label>
                            <p className="text-gray-900">
                              {selectedOrder.orderType === 'sales'
                                ? (selectedOrder as ConfirmedSalesOrder).excess_bdoi || 'N/A'
                                : (selectedOrder as ConfirmedPurchaseOrder).excess_bddi || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">
                              {selectedOrder.orderType === 'sales' ? 'MOI+BDOI' : 'MOI+BDDI'}
                            </label>
                            <p className="text-gray-900">
                              {selectedOrder.orderType === 'sales'
                                ? (selectedOrder as ConfirmedSalesOrder).moi_bdoi || 'N/A'
                                : (selectedOrder as ConfirmedPurchaseOrder).moi_bddi || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Weight Deduction (KG)</label>
                            <p className="text-gray-900">{selectedOrder.weight_deduction_kg || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">
                              Deduction ({selectedOrder.orderType === 'sales' ? 'MOI+BDOI' : 'MOI+BDDI'}) ₹
                            </label>
                            <p className="text-gray-900">
                              {formatCurrency(
                                selectedOrder.orderType === 'sales'
                                  ? (selectedOrder as ConfirmedSalesOrder).deduction_amount_moi_bdoi || 0
                                  : (selectedOrder as ConfirmedPurchaseOrder).deduction_amount_moi_bddi || 0
                              )}
                            </p>
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

      {/* Single Decline Reason Modal */}
      {singleDeclineOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Decline Order</h3>
              <p className="text-sm text-gray-600 mb-4">
                Provide decline reason for <span className="font-semibold">{singleDeclineOrder.invoice_number || singleDeclineOrder.id}</span>.
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Decline Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={singleDeclineReason}
                onChange={(e) => setSingleDeclineReason(e.target.value)}
                rows={4}
                placeholder="Enter reason..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
              <div className="flex gap-3 justify-end mt-5">
                <button
                  onClick={closeSingleDeclineModal}
                  disabled={approvalSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitSingleDecline}
                  disabled={approvalSubmitting || !singleDeclineReason.trim()}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                >
                  {approvalSubmitting ? 'Submitting...' : 'Submit Decline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Approval/Reject Modal */}
      {bulkDecisionOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Bulk Approval Decision</h3>
              <p className="text-sm text-gray-600 mb-4">
                Selected pending orders will be approved, and remaining pending orders will be rejected.
              </p>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-4 text-sm">
                <p className="text-gray-800">Pending in queue: <span className="font-semibold">{pendingQueueOrders.length}</span></p>
                <p className="text-green-700">Approve count: <span className="font-semibold">{selectedPendingCount}</span></p>
                <p className="text-red-700">Reject count: <span className="font-semibold">{bulkRejectCount}</span></p>
              </div>

              {bulkRejectCount > 0 && (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Common Rejection Reason (for all rejected orders) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={bulkDeclineReason}
                    onChange={(e) => setBulkDeclineReason(e.target.value)}
                    rows={4}
                    placeholder="Enter one common reason..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                  />
                </>
              )}

              <div className="flex gap-3 justify-end mt-5">
                <button
                  onClick={closeBulkDecisionModal}
                  disabled={approvalSubmitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitBulkDecision}
                  disabled={approvalSubmitting || (bulkRejectCount > 0 && !bulkDeclineReason.trim())}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {approvalSubmitting ? 'Applying...' : 'Apply Decision'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Delete</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to delete this {deleteConfirm.type === 'sales' ? 'sales' : 'purchase'} order? 
                This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm.id, deleteConfirm.type)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Edit Order</h3>
                <button
                  onClick={() => setEditingOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Transaction Date</label>
                  <input
                    type="date"
                    value={editFormData.transaction_date?.slice(0, 10) || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, transaction_date: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">State</label>
                  <input
                    type="text"
                    value={editFormData.state || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, state: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Commodity</label>
                  <input
                    type="text"
                    value={editFormData.commodity || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, commodity: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Variety</label>
                  <input
                    type="text"
                    value={editFormData.variety || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, variety: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Party Name</label>
                  <input
                    type="text"
                    value={editingOrder?.orderType === 'sales' ? (editFormData.seller_name || '') : (editFormData.supplier_name || '')}
                    onChange={(e) => setEditFormData((prev) => ({
                      ...prev,
                      seller_name: editingOrder?.orderType === 'sales' ? e.target.value : prev.seller_name,
                      supplier_name: editingOrder?.orderType === 'purchase' ? e.target.value : prev.supplier_name,
                    }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <input
                    type="text"
                    value={editFormData.location || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, location: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Warehouse Name</label>
                  <input
                    type="text"
                    value={editFormData.warehouse_name || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, warehouse_name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Chamber No.</label>
                  <input
                    type="text"
                    value={editFormData.chamber_no || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, chamber_no: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Gate Pass No.</label>
                  <input
                    type="text"
                    value={editFormData.gate_pass_no || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, gate_pass_no: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Weight Slip No.</label>
                  <input
                    type="text"
                    value={editFormData.weight_slip_no || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, weight_slip_no: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Delivery Location</label>
                  <input
                    type="text"
                    value={editFormData.delivery_location || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, delivery_location: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Gross Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.gross_weight_mt ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, gross_weight_mt: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Tare Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.tare_weight_mt ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, tare_weight_mt: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">No. of Bags</label>
                  <input
                    type="number"
                    value={editFormData.no_of_bags ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, no_of_bags: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Net Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.net_weight_mt ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, net_weight_mt: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Rate per MT</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.rate_per_mt ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, rate_per_mt: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Gross Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.gross_amount ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, gross_amount: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">HLW (if any)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.hlw_wheat ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, hlw_wheat: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Excess HLW</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.excess_hlw ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, excess_hlw: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">MOI</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.moisture_moi ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, moisture_moi: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Excess MOI</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.excess_moisture ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, excess_moisture: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">BDOI/BDDI</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.bdoi ?? editFormData.bddi ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, bdoi: Number(e.target.value), bddi: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Excess BDOI/BDDI</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.excess_bdoi ?? editFormData.excess_bddi ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, excess_bdoi: Number(e.target.value), excess_bddi: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">MOI+BDOI/BDDI</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.moi_bdoi ?? editFormData.moi_bddi ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, moi_bdoi: Number(e.target.value), moi_bddi: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Weight Deduction (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.weight_deduction_kg ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, weight_deduction_kg: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Net Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.net_amount ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, net_amount: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Other Deductions (JSON)</label>
                  <textarea
                    value={typeof editFormData.other_deductions === 'string' ? editFormData.other_deductions : JSON.stringify(editFormData.other_deductions || [])}
                    onChange={(e) => {
                      let otherDeductions = [];
                      try { otherDeductions = JSON.parse(e.target.value); } catch (err) { otherDeductions = []; }
                      setEditFormData((prev) => ({ ...prev, other_deductions: otherDeductions }));
                    }}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Remarks</label>
                  <textarea
                    value={editFormData.remarks || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Variety</label>
                  <input
                    type="text"
                    value={editFormData.variety || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, variety: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Supplier/Seller Name</label>
                  <input
                    type="text"
                    value={editingOrder?.orderType === 'sales' ? (editFormData.seller_name || '') : (editFormData.supplier_name || '')}
                    onChange={(e) => setEditFormData((prev) => ({
                      ...prev,
                      seller_name: editingOrder?.orderType === 'sales' ? e.target.value : prev.seller_name,
                      supplier_name: editingOrder?.orderType === 'purchase' ? e.target.value : prev.supplier_name,
                    }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Location</label>
                  <input
                    type="text"
                    value={editFormData.location || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, location: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Warehouse Name</label>
                  <input
                    type="text"
                    value={editFormData.warehouse_name || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, warehouse_name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Chamber No.</label>
                  <input
                    type="text"
                    value={editFormData.chamber_no || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, chamber_no: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Gate Pass No.</label>
                  <input
                    type="text"
                    value={editFormData.gate_pass_no || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, gate_pass_no: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Weight Slip No.</label>
                  <input
                    type="text"
                    value={editFormData.weight_slip_no || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, weight_slip_no: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Delivery Location</label>
                  <input
                    type="text"
                    value={editFormData.delivery_location || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, delivery_location: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Gross Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.gross_weight_mt ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, gross_weight_mt: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Tare Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.tare_weight_mt ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, tare_weight_mt: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">No. of Bags</label>
                  <input
                    type="number"
                    value={editFormData.no_of_bags ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, no_of_bags: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Net Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.net_weight_mt ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, net_weight_mt: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md borderline-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Rate Per MT</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.rate_per_mt ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, rate_per_mt: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Variety</label>
                  <input
                    type="text"
                    value={editFormData.variety || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, variety: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Vehicle No.</label>
                  <input
                    type="text"
                    value={editFormData.vehicle_no || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, vehicle_no: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Net Weight (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.net_weight_mt ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, net_weight_mt: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Rate per MT</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.rate_per_mt ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, rate_per_mt: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Gross Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.gross_amount ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, gross_amount: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Deduction Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.deduction_amount_hlw ?? editFormData.deduction_amount_moi_bdoi ?? ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, deduction_amount_hlw: Number(e.target.value), deduction_amount_moi_bdoi: Number(e.target.value) }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Remarks</label>
                  <textarea
                    value={editFormData.remarks || ''}
                    onChange={(e) => setEditFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Party Name</label>
                  <input
                    type="text"
                    value={editingOrder.orderType === 'sales' ? (editFormData.seller_name || '') : (editFormData.supplier_name || '')}
                    onChange={(e) => setEditFormData((prev) => ({
                      ...prev,
                      seller_name: editingOrder.orderType === 'sales' ? e.target.value : prev.seller_name,
                      supplier_name: editingOrder.orderType === 'purchase' ? e.target.value : prev.supplier_name,
                    }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={submitEdit}
                  disabled={editSaving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
