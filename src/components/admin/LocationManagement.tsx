import { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { useToastContext } from '../../contexts/ToastContext';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

interface LocationItem {
  id: string;
  name: string;
  state?: string;
  is_active: boolean;
  approval_status?: 'pending' | 'approved' | 'declined';
  declined_reason?: string;
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

interface LocationManagementProps {
  currentUserRole?: string;
  dataVersion?: number;
}

export default function LocationManagement({ currentUserRole, dataVersion }: LocationManagementProps) {
  const { showSuccess, showError } = useToastContext();
  const canApprove = currentUserRole === 'super_admin';
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedState, setSelectedState] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationItem | null>(null);
  const [locationForm, setLocationForm] = useState({ name: '' });
  const [duplicateMessage, setDuplicateMessage] = useState('');
  const [searchingDuplicate, setSearchingDuplicate] = useState(false);
  const [matchingLocations, setMatchingLocations] = useState<LocationItem[]>([]);
  const [declineLocation, setDeclineLocation] = useState<LocationItem | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [approvalSubmitting, setApprovalSubmitting] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const token = localStorage.getItem('auth_token');

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const url = selectedState.trim()
        ? `${apiUrl}/location-master?state=${encodeURIComponent(selectedState)}`
        : `${apiUrl}/location-master`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load locations');
      const data = await response.json();
      setLocations(data);
    } catch (error: any) {
      showError(error.message || 'Failed to load locations');
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [selectedState, apiUrl, token, showError]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations, dataVersion]);

  const effectiveState = (editingLocation?.state ?? selectedState ?? '').trim();
  // Realtime duplicate search (debounced)
  useEffect(() => {
    if (!locationForm.name.trim()) {
      setDuplicateMessage('');
      setMatchingLocations([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearchingDuplicate(true);
      setDuplicateMessage('');
      setMatchingLocations([]);
      try {
        const locationId = editingLocation?.id ?? (editingLocation as any)?._id;
        const params = new URLSearchParams({ q: locationForm.name.trim() });
        if (effectiveState) params.set('state', effectiveState);
        if (locationId) params.set('exclude_id', locationId);

        const res = await fetch(
          `${apiUrl}/location-master/search?${params.toString()}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (!res.ok) {
          throw new Error('Failed to search locations');
        }
        const data = await res.json();
        const matches = Array.isArray(data.matches) ? data.matches : [];
        setMatchingLocations(matches);

        if (data.existsAnywhere && data.location) {
          const existingState = toUpperCaseLabel(data.location.state);
          const existingName = toUpperCaseLabel(data.location.name);
          const selectedStateUpper = toUpperCaseLabel(effectiveState);
          if (existingState && selectedStateUpper && existingState !== selectedStateUpper) {
            setDuplicateMessage(`"${existingName}" already exists in "${existingState}". Same location cannot be added in another state.`);
          } else {
            setDuplicateMessage(`"${existingName}" already exists.`);
          }
        }
      } catch {
        setDuplicateMessage('');
        setMatchingLocations([]);
      } finally {
        setSearchingDuplicate(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [effectiveState, locationForm.name, editingLocation, apiUrl, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const stateForSubmit = (selectedState ?? editingLocation?.state ?? '').trim();
    if (!stateForSubmit && !editingLocation) {
      showError('Please select a state first');
      return;
    }
    if (!locationForm.name.trim()) {
      showError('Location name is required');
      return;
    }
    if (duplicateMessage) {
      showError(duplicateMessage);
      return;
    }

    try {
      const locationId = editingLocation?.id ?? (editingLocation as any)?._id;
      const url = editingLocation && locationId
        ? `${apiUrl}/location-master/${locationId}`
        : `${apiUrl}/location-master`;
      const method = editingLocation && locationId ? 'PUT' : 'POST';
      const body = {
        state: stateForSubmit || (editingLocation?.state ?? ''),
        name: toUpperCaseValue(locationForm.name.trim())
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save location');
      }

      const saved = await response.json();
      showSuccess(editingLocation ? 'Location updated successfully!' : 'Location added successfully!');
      resetForm();
      if (editingLocation) {
        setLocations(prev => prev.map(l => l.id === editingLocation.id ? { ...l, ...saved, state: saved.state ?? selectedState } : l));
      } else {
        setLocations(prev => [{ ...saved, id: saved.id || (saved as any)._id, state: saved.state ?? selectedState, is_active: true }, ...prev]);
      }
      loadLocations();
    } catch (error: any) {
      showError(error.message || 'Failed to save location');
    }
  };

  const handleEdit = (location: LocationItem) => {
    setEditingLocation(location);
    setLocationForm({ name: toUpperCaseLabel(location.name) });
    const stateVal = location.state ?? selectedState ?? '';
    setSelectedState(stateVal);
    setShowForm(true);
  };

  const handleDelete = async (location: LocationItem) => {
    if (!window.confirm(`Are you sure you want to deactivate "${location.name}"? It will no longer appear in Confirm Sales/Purchase order dropdowns.`)) {
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/location-master/${location.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to deactivate location');
      }
      showSuccess('Location deactivated successfully!');
      loadLocations();
    } catch (error: any) {
      showError(error.message || 'Failed to deactivate location');
    }
  };

  const handleLocationApproval = async (locationId: string, status: 'approved' | 'declined', declineReasonInput = '') => {
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
      const response = await fetch(`${apiUrl}/location-master/${locationId}/approval`, {
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

      showSuccess(`Location ${status === 'approved' ? 'approved' : 'declined'} successfully`);
      if (status === 'declined') {
        setDeclineLocation(null);
        setDeclineReason('');
      }
      loadLocations();
    } catch (error: any) {
      showError(error.message || 'Failed to update location approval');
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const resetForm = () => {
    setLocationForm({ name: '' });
    setEditingLocation(null);
    setShowForm(false);
    setDuplicateMessage('');
    setMatchingLocations([]);
  };

  const openDeclinePopup = (location: LocationItem) => {
    setDeclineLocation(location);
    setDeclineReason('');
  };

  const closeDeclinePopup = () => {
    if (approvalSubmitting) return;
    setDeclineLocation(null);
    setDeclineReason('');
  };

  if (!token) {
    return (
      <div className="p-4 text-red-600">Authentication required. Please log in.</div>
    );
  }

  const approvalStatus = (status?: string) => {
    if (status === 'approved') return 'approved';
    if (status === 'declined') return 'declined';
    return 'pending';
  };

  const activeLocations = locations.filter(l => l.is_active);
  const pendingLocations = activeLocations.filter((l) => approvalStatus(l.approval_status) === 'pending');
  const approvedLocations = activeLocations.filter((l) => approvalStatus(l.approval_status) === 'approved');
  const declinedLocations = activeLocations.filter((l) => approvalStatus(l.approval_status) === 'declined');
  const inactiveLocations = locations.filter(l => !l.is_active);

  const renderLocationSection = (
    title: string,
    subtitle: string,
    items: LocationItem[],
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

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
        </div>
      ) : items.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-400" />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">State</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Approval</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason / Notes</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((loc) => {
                const approval = approvalStatus(loc.approval_status);
                const isAdminLocked = currentUserRole === 'admin' && approval === 'approved';
                return (
                  <tr key={loc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{toUpperCaseLabel(loc.state || selectedState)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">{toUpperCaseLabel(loc.name)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getApprovalBadgeClass(loc.approval_status)}`}>
                        {getApprovalLabel(loc.approval_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-md">
                      {approval === 'declined' && loc.declined_reason ? (
                        <p className="text-red-700 break-words">{loc.declined_reason}</p>
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
                              onClick={() => handleLocationApproval(loc.id, 'approved')}
                              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-green-100 text-green-800 hover:bg-green-200"
                              title="Approve"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openDeclinePopup(loc)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200"
                              title="Reject"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleEdit(loc)}
                          disabled={isAdminLocked}
                          className="inline-flex items-center justify-center p-2 rounded-md text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isAdminLocked ? 'Approved location cannot be edited by Admin' : 'Edit'}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(loc)}
                          disabled={isAdminLocked}
                          className="inline-flex items-center justify-center p-2 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isAdminLocked ? 'Approved location cannot be deactivated by Admin' : 'Deactivate'}
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
          <MapPin className="w-8 h-8 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-800">Location Management</h1>
        </div>
      </div>

      <p className="text-gray-600">
        Use state filter, manage submissions, and track each location by status. Only approved locations are used in Confirm Sales/Purchase order forms.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase">Pending</p>
          <p className="text-2xl font-bold text-amber-900 mt-1">{pendingLocations.length}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-700 uppercase">Approved</p>
          <p className="text-2xl font-bold text-green-900 mt-1">{approvedLocations.length}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 uppercase">Rejected</p>
          <p className="text-2xl font-bold text-red-900 mt-1">{declinedLocations.length}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-700 uppercase">Inactive</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{inactiveLocations.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4 border border-gray-200">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Filter By State</label>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setShowForm(false);
                setEditingLocation(null);
                setLocationForm({ name: '' });
                setDuplicateMessage('');
                setMatchingLocations([]);
              }}
              className="w-full min-w-[260px] max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">ALL STATES</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{toUpperCaseLabel(s)}</option>
              ))}
            </select>
          </div>

          {(selectedState || editingLocation) && (
            <button
              onClick={() => { setShowForm(true); setEditingLocation(null); setLocationForm({ name: '' }); setDuplicateMessage(''); setMatchingLocations([]); }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Location
            </button>
          )}
        </div>
      </div>

      {showForm && (selectedState || editingLocation) && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </h2>
            <button type="button" onClick={resetForm} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              State <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedState || (editingLocation?.state ?? '')}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setDuplicateMessage('');
                setMatchingLocations([]);
              }}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">-- Choose State --</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{toUpperCaseLabel(s)}</option>
              ))}
            </select>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={locationForm.name}
                onChange={(e) => setLocationForm({ ...locationForm, name: toUpperCaseValue(e.target.value) })}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g. GULABBAGH, BUXAR, PATNA"
              />
              {searchingDuplicate && <p className="text-xs text-gray-500 mt-1">Checking...</p>}
              {duplicateMessage && <p className="text-sm text-red-600 mt-1">{duplicateMessage}</p>}
              {locationForm.name.trim() && matchingLocations.length > 0 && (
                <div className="mt-2 border border-amber-200 bg-amber-50 rounded-lg p-2">
                  <p className="text-xs font-medium text-amber-900 mb-1">
                    Matching locations for "{toUpperCaseLabel(locationForm.name.trim())}":
                  </p>
                  <ul className="max-h-32 overflow-y-auto space-y-1">
                    {matchingLocations.map((loc) => (
                      <li key={loc.id} className="text-xs text-amber-900">
                        {toUpperCaseLabel(loc.name)} <span className="text-amber-700">({toUpperCaseLabel(loc.state)})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
                {editingLocation ? 'Update' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}

      {renderLocationSection(
        selectedState ? `Pending Locations - ${toUpperCaseLabel(selectedState)}` : 'Pending Locations',
        'Submitted records waiting for Super Admin review',
        pendingLocations,
        selectedState ? 'No pending location in selected state.' : 'No pending location found.',
        'border-amber-200',
        true
      )}

      {renderLocationSection(
        selectedState ? `Approved Locations - ${toUpperCaseLabel(selectedState)}` : 'Approved Locations',
        'Approved records visible in Confirm Sales/Purchase orders',
        approvedLocations,
        selectedState ? 'No approved location in selected state.' : 'No approved location found.',
        'border-green-200',
        false
      )}

      {renderLocationSection(
        selectedState ? `Rejected Locations - ${toUpperCaseLabel(selectedState)}` : 'Rejected Locations',
        'Rejected records with decline reason visible for correction and resubmission',
        declinedLocations,
        selectedState ? 'No rejected location in selected state.' : 'No rejected location found.',
        'border-red-200',
        false
      )}

      {inactiveLocations.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Inactive Locations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {inactiveLocations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{toUpperCaseLabel(loc.state || selectedState)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500">{toUpperCaseLabel(loc.name)}</td>
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

      {declineLocation && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={closeDeclinePopup}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-gray-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Reject Location</h3>
              <p className="text-sm text-gray-600 mt-1">
                Add rejection reason for <span className="font-semibold">{toUpperCaseLabel(declineLocation.name)}</span>.
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
                onClick={() => handleLocationApproval(declineLocation.id, 'declined', declineReason)}
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
