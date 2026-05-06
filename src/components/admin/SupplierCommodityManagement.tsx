import { useState, useEffect } from 'react';
import { Truck, Plus, Edit2, Trash2, Package, MapPin, FileText, Calendar, Weight, ClipboardCheck } from 'lucide-react';
import { api } from '../../lib/client';
import SupplierQualityReport from './SupplierQualityReport';
import { usePopupContext } from '../../contexts/PopupContext';

interface Supplier {
  id: string;
  name: string;
  email: string;
  mobile_number: string;
}

interface Variety {
  commodity_name: string;
  variety_name: string;
}

interface Supply {
  id: string;
  supplier_id: string;
  date: string;
  commodity: string;
  variety: string;
  invoice_no: string;
  truck_number: string;
  weight_slip_no: string;
  bag_count: number;
  net_weight_mt: number;
  rate_per_mt: number;
  gross_amount: number;
  deduction_amount: number;
  net_amount: number;
  quality_report_status: string;
  delivery_location: string;
  notes: string;
  supplier: {
    name: string;
    email: string;
  };
}

export default function SupplierCommodityManagement() {
  const { showConfirm } = usePopupContext();
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [filteredVarieties, setFilteredVarieties] = useState<Variety[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [selectedSupplyForQuality, setSelectedSupplyForQuality] = useState<Supply | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form fields
  const [supplierId, setSupplierId] = useState('');
  const [date, setDate] = useState('');
  const [commodity, setCommodity] = useState('');
  const [variety, setVariety] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [truckNumber, setTruckNumber] = useState('');
  const [weightSlipNo, setWeightSlipNo] = useState('');
  const [bagCount, setBagCount] = useState<number>(0);
  const [netWeightMt, setNetWeightMt] = useState<number>(0);
  const [ratePerMt, setRatePerMt] = useState<number>(0);
  const [deductionAmount, setDeductionAmount] = useState<number>(0);
  const [qualityReportStatus, setQualityReportStatus] = useState('Pending');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [notes, setNotes] = useState('');

  const commodities = ['Paddy', 'Maize', 'Wheat'];

  useEffect(() => {
    loadSupplies();
    loadSuppliers();
    loadVarieties();
  }, []);

  useEffect(() => {
    if (commodity) {
      const filtered = varieties.filter(v => v.commodity_name === commodity);
      setFilteredVarieties(filtered);
    }
  }, [commodity, varieties]);

  const loadSupplies = async () => {
    const { data, error } = await api
      .from('supplier_commodity_supplies')
      .select(`
        *,
        supplier:profiles!supplier_commodity_supplies_supplier_id_fkey(name, email)
      `)
      .order('date', { ascending: false });

    if (!error && data) {
      setSupplies(data as any);
    }
  };

  const loadSuppliers = async () => {
    const { data, error } = await api
      .from('profiles')
      .select('id, name, email, mobile_number')
      .eq('role', 'customer')
      .eq('kyc_verified', true)
      .order('name', { ascending: true });

    if (!error && data) {
      setSuppliers(data);
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

  const resetForm = () => {
    setSupplierId('');
    setDate('');
    setCommodity('');
    setVariety('');
    setInvoiceNo('');
    setTruckNumber('');
    setWeightSlipNo('');
    setBagCount(0);
    setNetWeightMt(0);
    setRatePerMt(0);
    setDeductionAmount(0);
    setQualityReportStatus('Pending');
    setDeliveryLocation('');
    setNotes('');
    setEditingSupply(null);
    setShowForm(false);
  };

  const handleEdit = (supply: Supply) => {
    setEditingSupply(supply);
    setSupplierId(supply.supplier_id);
    setDate(supply.date);
    setCommodity(supply.commodity);
    setVariety(supply.variety);
    setInvoiceNo(supply.invoice_no);
    setTruckNumber(supply.truck_number);
    setWeightSlipNo(supply.weight_slip_no);
    setBagCount(supply.bag_count);
    setNetWeightMt(supply.net_weight_mt);
    setRatePerMt(supply.rate_per_mt);
    setDeductionAmount(supply.deduction_amount);
    setQualityReportStatus(supply.quality_report_status);
    setDeliveryLocation(supply.delivery_location);
    setNotes(supply.notes || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!supplierId || !date || !commodity || !variety || !invoiceNo || !truckNumber || !weightSlipNo || !deliveryLocation) {
      setError('Please fill all required fields');
      return;
    }

    setLoading(true);

    try {
      const supplyData = {
        supplier_id: supplierId,
        date,
        commodity,
        variety,
        invoice_no: invoiceNo,
        truck_number: truckNumber,
        weight_slip_no: weightSlipNo,
        bag_count: bagCount,
        net_weight_mt: netWeightMt,
        rate_per_mt: ratePerMt,
        deduction_amount: deductionAmount,
        quality_report_status: qualityReportStatus,
        delivery_location: deliveryLocation,
        notes,
      };

      if (editingSupply) {
        const { error: updateError } = await api
          .from('supplier_commodity_supplies')
          .update(supplyData)
          .eq('id', editingSupply.id);

        if (updateError) throw updateError;
        setSuccess('Supply record updated successfully!');
      } else {
        const { error: insertError } = await api
          .from('supplier_commodity_supplies')
          .insert(supplyData);

        if (insertError) throw insertError;
        setSuccess('Supply record added successfully!');
      }

      await loadSupplies();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save supply record');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Supply Record',
      message: 'Are you sure you want to delete this supply record?',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;

    const { error } = await api
      .from('supplier_commodity_supplies')
      .delete()
      .eq('id', id);

    if (!error) {
      setSuccess('Supply record deleted successfully!');
      await loadSupplies();
    }
  };

  const calculateGrossAmount = () => netWeightMt * ratePerMt;
  const calculateNetAmount = () => (netWeightMt * ratePerMt) - deductionAmount;

  return (
    <div className="space-y-6">
      <div className="bg-yellow-100 border-l-4 border-yellow-600 p-4">
        <h2 className="text-xl font-bold text-gray-900">
          4. Admin can buy the Commodities from the available vendors: To be entered by Admin
        </h2>
        <p className="text-sm text-gray-700 mt-1">
          Suppliers will be onboarded in the App platform with proper KYC
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Supplier Commodity Supplies</h3>
              <p className="text-sm text-gray-600">Track commodity purchases from verified suppliers</p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Supply Record
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-6 bg-gray-50 rounded-lg border-2 border-orange-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              {editingSupply ? 'Edit Supply Record' : 'Add New Supply Record'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier (KYC Verified)*</label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} - {s.mobile_number}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Commodity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commodity*</label>
                <select
                  value={commodity}
                  onChange={(e) => setCommodity(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                >
                  <option value="">Select Variety</option>
                  {filteredVarieties.map((v) => (
                    <option key={v.variety_name} value={v.variety_name}>
                      {v.variety_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Invoice No */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice No.*</label>
                <input
                  type="text"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  required
                  placeholder="384"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Truck Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Truck Number*</label>
                <input
                  type="text"
                  value={truckNumber}
                  onChange={(e) => setTruckNumber(e.target.value)}
                  required
                  placeholder="BR31 GA 7076"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Weight Slip No (RRY) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight Slip S.No. (RRY)*</label>
                <input
                  type="text"
                  value={weightSlipNo}
                  onChange={(e) => setWeightSlipNo(e.target.value)}
                  required
                  placeholder="101"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Bag Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bag Count*</label>
                <input
                  type="number"
                  value={bagCount || ''}
                  onChange={(e) => setBagCount(Number(e.target.value))}
                  required
                  min="0"
                  placeholder="259"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Rate per MT */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate (Auto Populated from Purchase Order)*</label>
                <input
                  type="number"
                  value={ratePerMt || ''}
                  onChange={(e) => setRatePerMt(Number(e.target.value))}
                  required
                  min="0"
                  step="0.01"
                  placeholder="25,250"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-yellow-50"
                />
              </div>

              {/* Deduction Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deduction (Refer below report)</label>
                <input
                  type="number"
                  value={deductionAmount || ''}
                  onChange={(e) => setDeductionAmount(Number(e.target.value))}
                  min="0"
                  step="0.01"
                  placeholder="4,384.03"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 bg-yellow-100"
                />
              </div>

              {/* Quality Report Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quality report (Refer below report)*</label>
                <select
                  value={qualityReportStatus}
                  onChange={(e) => setQualityReportStatus(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Pending">Pending</option>
                  <option value="Refer below report">Refer below report*</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Calculated Amounts */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white rounded-lg border-2 border-gray-300">
              <div>
                <p className="text-sm text-gray-600">Gross Amount (Rs.)</p>
                <p className="text-xl font-bold text-gray-900">
                  ₹{calculateGrossAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">Net MT x Rate</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Deduction (Rs.)</p>
                <p className="text-xl font-bold text-red-600">
                  ₹{deductionAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">Quality deductions</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Net Amount (Rs.)</p>
                <p className="text-xl font-bold text-green-600">
                  ₹{calculateNetAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">Gross - Deduction</p>
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
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
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingSupply ? 'Update Record' : 'Add Record'}
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

        {/* Supply Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 text-white">
              <tr>
                <th className="px-3 py-2 text-left">S.No.</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Commodity</th>
                <th className="px-3 py-2 text-left">Variety</th>
                <th className="px-3 py-2 text-left">Invoice No.</th>
                <th className="px-3 py-2 text-left">Truck Number</th>
                <th className="px-3 py-2 text-left">Weight Slip</th>
                <th className="px-3 py-2 text-left">Bags</th>
                <th className="px-3 py-2 text-left">Net Weight MT</th>
                <th className="px-3 py-2 text-left">Rate/MT</th>
                <th className="px-3 py-2 text-left">Gross Amount</th>
                <th className="px-3 py-2 text-left">Deduction</th>
                <th className="px-3 py-2 text-left">Net Amount</th>
                <th className="px-3 py-2 text-left">Quality Report</th>
                <th className="px-3 py-2 text-left">Delivery Location</th>
                <th className="px-3 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {supplies.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-gray-500">
                    No supply records found. Add your first record above.
                  </td>
                </tr>
              ) : (
                supplies.map((supply, idx) => (
                  <tr key={supply.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold">{idx + 1}</td>
                    <td className="px-3 py-2">{new Date(supply.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-3 py-2 font-medium">{supply.commodity}</td>
                    <td className="px-3 py-2">{supply.variety}</td>
                    <td className="px-3 py-2">{supply.invoice_no}</td>
                    <td className="px-3 py-2">{supply.truck_number}</td>
                    <td className="px-3 py-2">{supply.weight_slip_no}</td>
                    <td className="px-3 py-2 text-center">{supply.bag_count}</td>
                    <td className="px-3 py-2 font-semibold">{supply.net_weight_mt.toFixed(3)}</td>
                    <td className="px-3 py-2">₹{supply.rate_per_mt.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2 font-semibold">₹{supply.gross_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-red-600 font-semibold bg-yellow-100">
                      {supply.deduction_amount > 0 ? `₹${supply.deduction_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-3 py-2 font-bold text-green-700">₹{supply.net_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-1 rounded ${
                        supply.quality_report_status === 'Refer below report' ? 'bg-yellow-100 text-yellow-800' :
                        supply.quality_report_status === 'Approved' ? 'bg-green-100 text-green-800' :
                        supply.quality_report_status === 'Rejected' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {supply.quality_report_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate">{supply.delivery_location}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedSupplyForQuality(supply)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                          title="Quality Report"
                        >
                          <ClipboardCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(supply)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(supply.id)}
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
              {supplies.length > 0 && (
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={7} className="px-3 py-2 text-right">Total:</td>
                  <td className="px-3 py-2 text-center">{supplies.reduce((sum, s) => sum + s.bag_count, 0)}</td>
                  <td className="px-3 py-2">{supplies.reduce((sum, s) => sum + Number(s.net_weight_mt), 0).toFixed(2)}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">₹{supplies.reduce((sum, s) => sum + Number(s.gross_amount), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-red-600 bg-yellow-100">₹{supplies.reduce((sum, s) => sum + Number(s.deduction_amount), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-green-700">₹{supplies.reduce((sum, s) => sum + Number(s.net_amount), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td colSpan={3}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quality Report Modal */}
      {selectedSupplyForQuality && (
        <SupplierQualityReport
          supply={selectedSupplyForQuality}
          onClose={() => setSelectedSupplyForQuality(null)}
          onSave={() => {
            loadSupplies();
            setSuccess('Quality report saved and deduction updated!');
          }}
        />
      )}
    </div>
  );
}
