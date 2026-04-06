import { useState, useEffect, useCallback } from 'react';
import { Warehouse, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { useToastContext } from '../../contexts/ToastContext';

interface WarehouseItem {
  id: string;
  name: string;
  location_id?: string;
  is_active: boolean;
  approval_status?: 'pending' | 'approved' | 'declined';
  declined_reason?: string;
}

interface LocationItem {
  id: string;
  name: string;
  state?: string;
  is_active: boolean;
}

const toUpperCaseValue = (value: string) => value.toUpperCase();
const toUpperCaseLabel = (value?: string) => (value ? value.toUpperCase() : '');
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

interface WarehouseManagementProps {
  currentUserRole?: string;
  dataVersion?: number;
}

export default function WarehouseManagement({ currentUserRole, dataVersion }: WarehouseManagementProps) {
  const { showSuccess, showError } = useToastContext();
  const canApprove = currentUserRole === 'super_admin';
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null);
  const [warehouseForm, setWarehouseForm] = useState({ name: '' });
  const [duplicateMessage, setDuplicateMessage] = useState('');
  const [searchingDuplicate, setSearchingDuplicate] = useState(false);
  const [declineWarehouse, setDeclineWarehouse] = useState<WarehouseItem | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const token = localStorage.getItem('auth_token');

  const loadLocations = useCallback(async () => {
    if (!token) {
      setLoadingLocations(false);
      return;
    }
    setLoadingLocations(true);
    try {
      const res = await fetch(`${apiUrl}/location-master?is_active=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load locations');
      const data = await res.json();
      setLocations(data);
    } catch (e: any) {
      showError(e.message || 'Failed to load locations');
      setLocations([]);
    } finally {
      setLoadingLocations(false);
    }
  }, [apiUrl, token, showError]);

  const loadWarehouses = useCallback(async () => {
    setLoadingWarehouses(true);
    try {
      const url = selectedLocationId.trim()
        ? `${apiUrl}/warehouse-master?location_id=${encodeURIComponent(selectedLocationId)}`
        : `${apiUrl}/warehouse-master`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load warehouses');
      const data = await res.json();
      setWarehouses(data);
    } catch (e: any) {
      showError(e.message || 'Failed to load warehouses');
      setWarehouses([]);
    } finally {
      setLoadingWarehouses(false);
    }
  }, [selectedLocationId, apiUrl, token, showError]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations, dataVersion]);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses, dataVersion]);

  // Realtime duplicate search (debounced)
  useEffect(() => {
    if (!selectedLocationId.trim() || !warehouseForm.name.trim()) {
      setDuplicateMessage('');
      return;
    }
    const t = setTimeout(async () => {
      setSearchingDuplicate(true);
      setDuplicateMessage('');
      try {
        const res = await fetch(
          `${apiUrl}/warehouse-master/search?location_id=${encodeURIComponent(selectedLocationId)}&q=${encodeURIComponent(warehouseForm.name.trim())}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        const data = await res.json();
        if (data.exists && (!editingWarehouse || data.warehouse?.id !== editingWarehouse.id)) {
          setDuplicateMessage('A warehouse with this name already exists at this location. Cannot create duplicate.');
        }
      } catch {
        setDuplicateMessage('');
      } finally {
        setSearchingDuplicate(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [selectedLocationId, warehouseForm.name, editingWarehouse, apiUrl, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const locIdForSubmit = (selectedLocationId || (editingWarehouse?.location_id != null ? String(editingWarehouse.location_id) : ''))?.trim() ?? '';
    if (!locIdForSubmit) {
      showError('Please select a location');
      return;
    }
    if (!warehouseForm.name.trim()) {
      showError('Warehouse name is required');
      return;
    }
    if (duplicateMessage) {
      showError(duplicateMessage);
      return;
    }

    try {
      const warehouseId = editingWarehouse?.id ?? (editingWarehouse as any)?._id;
      const url = editingWarehouse && warehouseId
        ? `${apiUrl}/warehouse-master/${warehouseId}`
        : `${apiUrl}/warehouse-master`;
      const method = editingWarehouse && warehouseId ? 'PUT' : 'POST';
      const body = { location_id: locIdForSubmit, name: toUpperCaseValue(warehouseForm.name.trim()) };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save warehouse');
      }

      const saved = await response.json();
      showSuccess(editingWarehouse ? 'Warehouse updated successfully!' : 'Warehouse created successfully!');
      resetForm();
      if (editingWarehouse) {
        setWarehouses(prev => prev.map(w => w.id === editingWarehouse.id ? { ...w, ...saved, location_id: saved.location_id ?? selectedLocationId } : w));
      } else {
        setWarehouses(prev => [{ ...saved, id: saved.id || (saved as any)._id, location_id: saved.location_id ?? selectedLocationId, is_active: true }, ...prev]);
      }
      loadWarehouses();
    } catch (error: any) {
      showError(error.message || 'Failed to save warehouse');
    }
  };

  const handleEdit = (warehouse: WarehouseItem) => {
    setEditingWarehouse(warehouse);
    setWarehouseForm({ name: toUpperCaseLabel(warehouse.name) });
    const locId = warehouse.location_id != null ? String(warehouse.location_id) : selectedLocationId || '';
    setSelectedLocationId(locId);
    setShowForm(true);
  };

  const handleDelete = async (warehouse: WarehouseItem) => {
    if (!window.confirm(`Are you sure you want to deactivate "${warehouse.name}"?`)) return;
    try {
      const res = await fetch(`${apiUrl}/warehouse-master/${warehouse.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to deactivate warehouse');
      }
      showSuccess('Warehouse deactivated successfully!');
      loadWarehouses();
    } catch (error: any) {
      showError(error.message || 'Failed to deactivate warehouse');
    }
  };

  const handleWarehouseApproval = async (warehouseId: string, status: 'approved' | 'declined', declineReasonInput = '') => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        showError('Authentication required');
        return;
      }

      const reason = String(declineReasonInput || '').trim();
      if (status === 'declined' && !reason) {
        showError('Decline reason is required');
        return;
      }

      setApprovalSubmitting(true);
      const response = await fetch(`${apiUrl}/warehouse-master/${warehouseId}/approval`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, reason })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update approval');
      }

      showSuccess(`Warehouse ${status === 'approved' ? 'approved' : 'declined'} successfully`);
      if (status === 'declined') {
        setDeclineWarehouse(null);
        setDeclineReason('');
      }
      loadWarehouses();
    } catch (error: any) {
      showError(error.message || 'Failed to update warehouse approval');
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const resetForm = () => {
    setWarehouseForm({ name: '' });
    setEditingWarehouse(null);
    setShowForm(false);
    setDuplicateMessage('');
  };

  const openDeclinePopup = (warehouse: WarehouseItem) => {
    setDeclineWarehouse(warehouse);
    setDeclineReason('');
  };

  const closeDeclinePopup = () => {
    if (approvalSubmitting) return;
    setDeclineWarehouse(null);
    setDeclineReason('');
  };

  if (!token) {
    return (
      <div className="p-4 text-red-600">Authentication required. Please log in.</div>
    );
  }

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const approvalStatus = (status?: string) => {
    if (status === 'approved') return 'approved';
    if (status === 'declined') return 'declined';
    return 'pending';
  };

  const activeWarehouses = warehouses.filter(w => w.is_active);
  const pendingWarehouses = activeWarehouses.filter((w) => approvalStatus(w.approval_status) === 'pending');
  const approvedWarehouses = activeWarehouses.filter((w) => approvalStatus(w.approval_status) === 'approved');
  const declinedWarehouses = activeWarehouses.filter((w) => approvalStatus(w.approval_status) === 'declined');
  const inactiveWarehouses = warehouses.filter(w => !w.is_active);

  const renderWarehouseSection = (
    title: string,
    subtitle: string,
    items: WarehouseItem[],
    emptyMessage: string,
    toneClasses: string,
    showApprovalActions: boolean
  ) => (
    <div className={`bg-white rounded-xl shadow border overflow-hidden ${toneClasses}`}>
      <div className="p-5 border-b border-gray-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          </div>
          <span className="inline-flex items-center justify-center min-w-10 h-10 px-3 rounded-full bg-white/90 border border-gray-200 text-sm font-bold text-gray-800">
            {items.length}
          </span>
        </div>
      </div>

      {loadingWarehouses ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <Warehouse className="w-10 h-10 mx-auto mb-2 text-gray-400" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Warehouse</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Approval</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason / Notes</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((wh) => {
                const approval = approvalStatus(wh.approval_status);
                const isAdminLocked = currentUserRole === 'admin' && approval === 'approved';
                return (
                  <tr key={wh.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{toUpperCaseLabel(wh.name)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getApprovalBadgeClass(wh.approval_status)}`}>
                        {getApprovalLabel(wh.approval_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
                      {approval === 'declined' && wh.declined_reason ? (
                        <p className="text-red-700 break-words">{wh.declined_reason}</p>
                      ) : approval === 'pending' ? (
                        <span className="text-amber-700">Awaiting Super Admin review</span>
                      ) : (
                        <span className="text-green-700">Approved and available for confirmed orders</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {canApprove && showApprovalActions && approval === 'pending' && (
                          <>
                            <button
                              onClick={() => handleWarehouseApproval(wh.id, 'approved')}
                              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-green-100 text-green-800 hover:bg-green-200"
                              title="Approve"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openDeclinePopup(wh)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200"
                              title="Reject"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleEdit(wh)}
                          disabled={isAdminLocked}
                          className="inline-flex items-center justify-center p-2 rounded-md text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isAdminLocked ? 'Approved warehouse cannot be edited by Admin' : 'Edit'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(wh)}
                          disabled={isAdminLocked}
                          className="inline-flex items-center justify-center p-2 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isAdminLocked ? 'Approved warehouse cannot be deactivated by Admin' : 'Deactivate'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Warehouse className="w-8 h-8 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-800">Warehouse Management</h1>
        </div>
      </div>

      <p className="text-gray-600">
        Manage warehouse submissions by approval status. Only approved warehouses are available in Confirm Sales/Purchase order forms.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase">Pending</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{pendingWarehouses.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-700 uppercase">Approved</p>
          <p className="text-2xl font-bold text-green-900 mt-1">{approvedWarehouses.length}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 uppercase">Rejected</p>
          <p className="text-2xl font-bold text-red-900 mt-1">{declinedWarehouses.length}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 uppercase">Inactive</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{inactiveWarehouses.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter By Location</label>
            <select
              value={selectedLocationId}
              onChange={(e) => {
                setSelectedLocationId(e.target.value);
                setShowForm(false);
                setEditingWarehouse(null);
                setWarehouseForm({ name: '' });
                setDuplicateMessage('');
              }}
              className="w-full min-w-[260px] max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              disabled={loadingLocations}
            >
              <option value="">ALL LOCATIONS</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {toUpperCaseLabel(loc.name)}{loc.state ? ` (${toUpperCaseLabel(loc.state)})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedLocationId && (
            <button
              onClick={() => { setShowForm(true); setEditingWarehouse(null); setWarehouseForm({ name: '' }); setDuplicateMessage(''); }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Warehouse
            </button>
          )}
        </div>
      </div>

      {showForm && (selectedLocationId || editingWarehouse) && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}
            </h2>
            <button type="button" onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedLocationId}
              onChange={(e) => {
                setSelectedLocationId(e.target.value);
                setDuplicateMessage('');
              }}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">-- Choose Location --</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {toUpperCaseLabel(loc.name)}{loc.state ? ` (${toUpperCaseLabel(loc.state)})` : ''}
                </option>
              ))}
            </select>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={warehouseForm.name}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, name: toUpperCaseValue(e.target.value) })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Enter warehouse name"
              />
              {searchingDuplicate && <p className="text-xs text-gray-500 mt-1">Checking...</p>}
              {duplicateMessage && <p className="text-sm text-red-600 mt-1">{duplicateMessage}</p>}
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={resetForm} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!!duplicateMessage || searchingDuplicate}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {editingWarehouse ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      )}

      {renderWarehouseSection(
        selectedLocationId
          ? `Pending Warehouses - ${toUpperCaseLabel(selectedLocation?.name || 'SELECTED LOCATION')}`
          : 'Pending Warehouses',
        'Submitted records waiting for Super Admin review',
        pendingWarehouses,
        selectedLocationId ? 'No pending warehouse for selected location.' : 'No pending warehouse found.',
        'border-amber-200',
        true
      )}

      {renderWarehouseSection(
        selectedLocationId
          ? `Approved Warehouses - ${toUpperCaseLabel(selectedLocation?.name || 'SELECTED LOCATION')}`
          : 'Approved Warehouses',
        'Approved records visible in Confirm Sales/Purchase orders',
        approvedWarehouses,
        selectedLocationId ? 'No approved warehouse for selected location.' : 'No approved warehouse found.',
        'border-green-200',
        false
      )}

      {renderWarehouseSection(
        selectedLocationId
          ? `Rejected Warehouses - ${toUpperCaseLabel(selectedLocation?.name || 'SELECTED LOCATION')}`
          : 'Rejected Warehouses',
        'Rejected records with decline reason visible for correction and resubmission',
        declinedWarehouses,
        selectedLocationId ? 'No rejected warehouse for selected location.' : 'No rejected warehouse found.',
        'border-red-200',
        false
      )}

      {inactiveWarehouses.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Inactive Warehouses</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Warehouse Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inactiveWarehouses.map((wh) => (
                  <tr key={wh.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">{toUpperCaseLabel(wh.name)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Inactive</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {declineWarehouse && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closeDeclinePopup}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Reject Warehouse</h3>
              <p className="text-sm text-gray-600 mt-1">
                Add rejection reason for <span className="font-semibold">{toUpperCaseLabel(declineWarehouse.name)}</span>.
              </p>
            </div>
            <div className="px-5 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={4}
                placeholder="Enter reason..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeDeclinePopup}
                disabled={approvalSubmitting}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleWarehouseApproval(declineWarehouse.id, 'declined', declineReason)}
                disabled={approvalSubmitting || !declineReason.trim()}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {approvalSubmitting ? 'Submitting...' : 'Submit Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
