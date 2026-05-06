import { useState, useEffect } from 'react';
import { Store, Plus, Edit2, Trash2, ClipboardCheck } from 'lucide-react';
import { api } from '../../lib/client';
import CustomerQualityReport from './CustomerQualityReport';
import { usePopupContext } from '../../contexts/PopupContext';

interface Customer {
  id: string;
  name: string;
  email: string;
  mobile_number: string;
}

interface Variety {
  commodity_name: string;
  variety_name: string;
}

interface LogisticsProvider {
  id: string;
  company_name: string;
  pickup_city: string;
  delivery_city: string;
  contact_person: string;
  mobile_number: string;
}

interface Sale {
  id: string;
  customer_id: string;
  date: string;
  commodity: string;
  variety: string;
  invoice_no: string;
  weight_slip_no: string;
  bag_count: number;
  net_weight_mt: number;
  rate_per_mt: number;
  gross_amount: number;
  deduction_amount: number;
  net_amount: number;
  quality_report_ref: string;
  delivery_location: string;
  logistics_provider_id: string | null;
  notes: string;
  customer: {
    name: string;
    email: string;
  };
  logistics_provider?: {
    company_name: string;
    contact_person: string;
    mobile_number: string;
  };
}

export default function CustomerCommoditySales() {
  const { showConfirm } = usePopupContext();
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [filteredVarieties, setFilteredVarieties] = useState<Variety[]>([]);
  const [logisticsProviders, setLogisticsProviders] = useState<LogisticsProvider[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [selectedSaleForQuality, setSelectedSaleForQuality] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState('');
  const [commodity, setCommodity] = useState('');
  const [variety, setVariety] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [weightSlipNo, setWeightSlipNo] = useState('');
  const [bagCount, setBagCount] = useState<number>(0);
  const [netWeightMt, setNetWeightMt] = useState<number>(0);
  const [ratePerMt, setRatePerMt] = useState<number>(0);
  const [deductionAmount, setDeductionAmount] = useState<number>(0);
  const [qualityReportRef, setQualityReportRef] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [logisticsProviderId, setLogisticsProviderId] = useState('');
  const [notes, setNotes] = useState('');

  const commodities = ['Paddy', 'Maize', 'Wheat'];

  useEffect(() => {
    loadSales();
    loadCustomers();
    loadVarieties();
    loadLogisticsProviders();
  }, []);

  useEffect(() => {
    if (commodity) {
      const filtered = varieties.filter(v => v.commodity_name === commodity);
      setFilteredVarieties(filtered);
    }
  }, [commodity, varieties]);

  const loadSales = async () => {
    const { data, error } = await api
      .from('customer_commodity_sales')
      .select(`
        *,
        customer:profiles!customer_commodity_sales_customer_id_fkey(name, email),
        logistics_provider:logistics_providers(company_name, contact_person, mobile_number)
      `)
      .order('date', { ascending: false });

    if (!error && data) {
      setSales(data as any);
    }
  };

  const loadCustomers = async () => {
    const { data, error } = await api
      .from('profiles')
      .select('id, name, email, mobile_number')
      .eq('role', 'customer')
      .eq('kyc_verified', true)
      .order('name', { ascending: true });

    if (!error && data) {
      setCustomers(data);
    }
  };

  const loadVarieties = async () => {
    const { data, error } = await api
      .from('variety_master')
      .select('*')
      .eq('is_active', true)
      .order('commodity_name', { ascending: true })
      .order('variety_name', { ascending: true });

    if (data) {
      setVarieties(data);
    }
  };

  const loadLogisticsProviders = async () => {
    const { data, error } = await api
      .from('logistics_providers')
      .select('id, company_name, mobile_number')
      .eq('is_active', true)
      .order('company_name', { ascending: true });

    if (data) {
      setLogisticsProviders(data);
    }
  };

  const resetForm = () => {
    setCustomerId('');
    setDate('');
    setCommodity('');
    setVariety('');
    setInvoiceNo('');
    setWeightSlipNo('');
    setBagCount(0);
    setNetWeightMt(0);
    setRatePerMt(0);
    setDeductionAmount(0);
    setQualityReportRef('');
    setDeliveryLocation('');
    setLogisticsProviderId('');
    setNotes('');
    setEditingSale(null);
    setShowForm(false);
  };

  const handleEdit = (sale: Sale) => {
    setEditingSale(sale);
    setCustomerId(sale.customer_id);
    setDate(sale.date);
    setCommodity(sale.commodity);
    setVariety(sale.variety);
    setInvoiceNo(sale.invoice_no);
    setWeightSlipNo(sale.weight_slip_no);
    setBagCount(sale.bag_count);
    setNetWeightMt(sale.net_weight_mt);
    setRatePerMt(sale.rate_per_mt);
    setDeductionAmount(sale.deduction_amount);
    setQualityReportRef(sale.quality_report_ref || '');
    setDeliveryLocation(sale.delivery_location);
    setLogisticsProviderId(sale.logistics_provider_id || '');
    setNotes(sale.notes || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!customerId || !date || !commodity || !variety || !invoiceNo || !weightSlipNo || !deliveryLocation) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      const saleData = {
        customer_id: customerId,
        date,
        commodity,
        variety,
        invoice_no: invoiceNo,
        weight_slip_no: weightSlipNo,
        bag_count: bagCount,
        net_weight_mt: netWeightMt,
        rate_per_mt: ratePerMt,
        deduction_amount: deductionAmount,
        quality_report_ref: qualityReportRef,
        delivery_location: deliveryLocation,
        logistics_provider_id: logisticsProviderId || null,
        notes,
      };

      if (editingSale) {
        const { error: updateError } = await api
          .from('customer_commodity_sales')
          .update(saleData)
          .eq('id', editingSale.id);

        if (updateError) throw updateError;
        setSuccess('Sale record updated successfully!');
      } else {
        const { error: insertError } = await api
          .from('customer_commodity_sales')
          .insert(saleData);

        if (insertError) throw insertError;
        setSuccess('Sale record added successfully!');
      }

      await loadSales();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save sale record');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Sale Record',
      message: 'Are you sure you want to delete this sale record?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;

    const { error } = await api
      .from('customer_commodity_sales')
      .delete()
      .eq('id', id);

    if (!error) {
      setSuccess('Sale record deleted successfully!');
      await loadSales();
    }
  };

  const calculateGrossAmount = () => netWeightMt * ratePerMt;
  const calculateNetAmount = () => (netWeightMt * ratePerMt) - deductionAmount;

  return (
    <div className="space-y-6">
      <div className="bg-yellow-100 border-l-4 border-yellow-600 p-4">
        <h2 className="text-xl font-bold text-gray-900">
          5. Admin can sell the Commodities from the available customers: To be entered by Admin
        </h2>
        <p className="text-sm text-gray-700 mt-1">
          Customers will be onboarded in the App platform after proper KYC
        </p>
        <p className="text-xs text-gray-600 mt-1 italic">
          All supplies to Customer will be reflected here as per below information entered by Admin:
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Store className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Customer Commodity Sales</h3>
              <p className="text-sm text-gray-600">Track commodity sales to verified customers</p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Sale Record
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-6 bg-gray-50 rounded-lg border-2 border-blue-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              {editingSale ? 'Edit Sale Record' : 'Add New Sale Record'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer (KYC Verified)*</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.mobile_number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date*</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Commodity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commodity*</label>
                <select
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Commodity</option>
                  {commodities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Variety */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variety*</label>
                <select
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                  required
                  disabled={!commodity}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select Variety</option>
                  {filteredVarieties.map((v) => (
                    <option key={v.variety_name} value={v.variety_name}>
                      {v.variety_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice No (Editable) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice No. (Editable)*
                </label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  required
                  placeholder="1001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                />
              </div>

              {/* Weight Slip No */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight Slip S.No. (RRY)*</label>
                <input
                  type="text"
                  value={weightSlipNo}
                  onChange={(e) => setWeightSlipNo(e.target.value)}
                  required
                  placeholder="101"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Bag Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bag*</label>
                <input
                  type="number"
                  value={bagCount || ''}
                  onChange={(e) => setBagCount(Number(e.target.value))}
                  required
                  min="0"
                  placeholder="259"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Net Weight in MT */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Net Weight in MT*</label>
                <input
                  type="number"
                  value={netWeightMt || ''}
                  onChange={(e) => setNetWeightMt(Number(e.target.value))}
                  required
                  min="0"
                  step="0.001"
                  placeholder="11.575"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate*</label>
                <input
                  type="number"
                  value={ratePerMt || ''}
                  onChange={(e) => setRatePerMt(Number(e.target.value))}
                  required
                  min="0"
                  step="0.01"
                  placeholder="25,510"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-yellow-50"
                />
              </div>

              {/* Deduction */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deduction (Refer below report)
                </label>
                <input
                  type="number"
                  value={deductionAmount || ''}
                  onChange={(e) => setDeductionAmount(Number(e.target.value))}
                  min="0"
                  step="0.01"
                  placeholder="4,429.17"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-yellow-100"
                />
              </div>

              {/* Quality Report */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quality report</label>
                <input
                  type="text"
                  value={qualityReportRef}
                  onChange={(e) => setQualityReportRef(e.target.value)}
                  placeholder="Refer below report"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Logistics Provider */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logistics Provider
              </label>
              <select
                value={logisticsProviderId}
                onChange={(e) => setLogisticsProviderId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-green-50"
              >
                <option value="">Select Logistics Provider (Optional)</option>
                {logisticsProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.company_name} ({provider.mobile_number})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Active logistics providers added in Logistics Provider Management
              </p>
            </div>

            {/* Delivery Location */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Location*</label>
              <textarea
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                required
                rows={2}
                placeholder="Address of Supply (i.e Vinod Kumar Warehouse, near Banjara Hotel, Village Harpur, Maliabagh, Bihar)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Calculated Amounts */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-lg border-2 border-gray-300">
              <div>
                <p className="text-sm text-gray-600">Gross Amount (Rs.) [Net MT x Rate]</p>
                <p className="text-xl font-bold text-gray-900">
                  ₹{calculateGrossAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Deduction (Rs.)</p>
                <p className="text-xl font-bold text-red-600">
                  ₹{deductionAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Net Amount (Rs.) [Gross Amount - Deduction]</p>
                <p className="text-xl font-bold text-green-600">
                  ₹{calculateNetAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Notes */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Additional notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            {/* Form Actions */}
            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingSale ? 'Update Record' : 'Add Record'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Sales Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-3 py-2 text-left">S.No.</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Commodity</th>
                <th className="px-3 py-2 text-left">Variety</th>
                <th className="px-3 py-2 text-left bg-yellow-600">Invoice No. (Editable)</th>
                <th className="px-3 py-2 text-left">Weight Slip S.No. (RRY)</th>
                <th className="px-3 py-2 text-left">Bag</th>
                <th className="px-3 py-2 text-left">Net Weight in MT</th>
                <th className="px-3 py-2 text-left bg-yellow-600">Rate</th>
                <th className="px-3 py-2 text-left">Gross Amount (Rs.) [Net MT x Rate]</th>
                <th className="px-3 py-2 text-left bg-yellow-600">Deduction (Refer below report)</th>
                <th className="px-3 py-2 text-left">Net Amount (Rs.) [Gross Amount - Deduction]</th>
                <th className="px-3 py-2 text-left">Quality report</th>
                <th className="px-3 py-2 text-left">Delivery Location</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-8 text-center text-gray-500">
                    No sale records found. Add your first record above.
                  </td>
                </tr>
              ) : (
                sales.map((sale, idx) => (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold">{idx + 1}</td>
                    <td className="px-3 py-2">{new Date(sale.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-3 py-2 font-medium">{sale.commodity}</td>
                    <td className="px-3 py-2">{sale.variety}</td>
                    <td className="px-3 py-2 bg-yellow-100 font-semibold">{sale.invoice_no}</td>
                    <td className="px-3 py-2">{sale.weight_slip_no}</td>
                    <td className="px-3 py-2 text-center">{sale.bag_count}</td>
                    <td className="px-3 py-2 font-semibold">{sale.net_weight_mt.toFixed(3)}</td>
                    <td className="px-3 py-2 bg-yellow-100">₹{sale.rate_per_mt.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 font-semibold">₹{sale.gross_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-red-600 font-semibold bg-yellow-100">
                      {sale.deduction_amount > 0 ? `₹${sale.deduction_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-3 py-2 font-bold text-green-700">₹{sale.net_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-xs">{sale.quality_report_ref || '-'}</td>
                    <td className="px-3 py-2 max-w-xs truncate text-xs">{sale.delivery_location}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedSaleForQuality(sale)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Quality Report"
                        >
                          <ClipboardCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(sale)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(sale.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
              {sales.length > 0 && (
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={6} className="px-3 py-2 text-right">Total:</td>
                  <td className="px-3 py-2 text-center">{sales.reduce((sum, s) => sum + s.bag_count, 0)}</td>
                  <td className="px-3 py-2">{sales.reduce((sum, s) => sum + Number(s.net_weight_mt), 0).toFixed(2)}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">₹{sales.reduce((sum, s) => sum + Number(s.gross_amount), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-red-600 bg-yellow-100">₹{sales.reduce((sum, s) => sum + Number(s.deduction_amount), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-green-700">₹{sales.reduce((sum, s) => sum + Number(s.net_amount), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td colSpan={3}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quality Report Modal */}
      {selectedSaleForQuality && (
        <CustomerQualityReport
          sale={selectedSaleForQuality}
          onClose={() => setSelectedSaleForQuality(null)}
        />
      )}
    </div>
  );
}
