import { useState, useEffect } from 'react';
import { type Profile } from '../../lib/client';
import { Search, Filter, Shield, XCircle, User, Building, Eye, EyeOff, FileText, Download, ThumbsUp, ThumbsDown, UserPlus, Link2, Copy, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usePopupContext } from '../../contexts/PopupContext';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getDocumentTypeLabel(docType: string, documentTypeLabel?: string): string {
  if (docType === 'other' && documentTypeLabel && documentTypeLabel.trim()) {
    return documentTypeLabel.trim();
  }
  const labels: Record<string, string> = {
    cin: 'Incorporation Certificate',
    aadhaar: 'Aadhaar',
    pan: 'PAN',
    driving_license: 'Driving License',
    voter_id: 'Voter ID',
    passport: 'Passport',
    gstin: 'GSTIN',
    other: 'Other',
    registration_certificate: 'Incorporation Certificate', // legacy – show as Incorporation Certificate
  };
  return labels[docType || ''] || (docType || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

async function adminUpdateUser(userId: string, body: Record<string, unknown>) {
  const token = localStorage.getItem('auth_token');
  const id = String(userId).trim();
  if (!id || id === 'undefined') throw new Error('Invalid user id');
  const res = await fetch(`${apiUrl}/admin/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || 'Update failed');
  }
  return res.json();
}

async function adminGetUserPassword(userId: string) {
  const token = localStorage.getItem('auth_token');
  const id = String(userId).trim();
  if (!id || id === 'undefined') throw new Error('Invalid user id');
  const res = await fetch(`${apiUrl}/admin/users/${encodeURIComponent(id)}/password`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Failed to fetch password');
  }
  return data;
}

async function adminGenerateReentryLink(userId: string) {
  const token = localStorage.getItem('auth_token');
  const id = String(userId).trim();
  if (!id || id === 'undefined') throw new Error('Invalid user id');
  const res = await fetch(`${apiUrl}/admin/users/${encodeURIComponent(id)}/reentry-link`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Failed to generate re-entry link');
  }
  return data;
}

async function adminDeleteUser(userId: string) {
  const token = localStorage.getItem('auth_token');
  const id = String(userId).trim();
  if (!id || id === 'undefined') throw new Error('Invalid user id');
  const res = await fetch(`${apiUrl}/admin/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.message || 'Delete failed');
  }
  return data;
}

interface UserManagementProps {
  users: Profile[];
  onRefresh: () => void;
  onUserUpdated?: (userId: string, updates: Partial<Profile>) => void;
  currentUserRole?: Profile['role'];
  currentUserId?: string;
}

export default function UserManagement({ users, onRefresh, onUserUpdated, currentUserRole, currentUserId }: UserManagementProps) {
  const { showAlert, showConfirm } = usePopupContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showPendingSection, setShowPendingSection] = useState(true);
  const [showRejectedSection, setShowRejectedSection] = useState(true);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userDocument, setUserDocument] = useState<any>(null);
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<{ view_url: string; file_name?: string; document_type?: string; document_type_label?: string; view_access?: string } | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [disapproveConfirmUserId, setDisapproveConfirmUserId] = useState<string | null>(null);
  const [declineReasonDraft, setDeclineReasonDraft] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState<string | null>(null);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [reentryLinks, setReentryLinks] = useState<Record<string, string>>({});
  const [generatingReentryLinkFor, setGeneratingReentryLinkFor] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const canApproveUsers = currentUserRole === 'super_admin';
  const canGenerateReentryLink = currentUserRole === 'admin' || currentUserRole === 'super_admin';
  const canDeleteUsers = currentUserRole === 'admin' || currentUserRole === 'super_admin';

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.trade_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user as any).mobile_number?.includes(searchTerm);

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const roleStats = [
    { key: 'farmer', label: 'Farmers', value: users.filter((u) => u.role === 'farmer').length, cardClass: 'bg-green-50 border-green-200', labelClass: 'text-green-700', valueClass: 'text-green-800' },
    { key: 'trader', label: 'Traders', value: users.filter((u) => u.role === 'trader').length, cardClass: 'bg-teal-50 border-teal-200', labelClass: 'text-teal-700', valueClass: 'text-teal-800' },
    { key: 'corporate', label: 'Corporate', value: users.filter((u) => u.role === 'corporate').length, cardClass: 'bg-indigo-50 border-indigo-200', labelClass: 'text-indigo-700', valueClass: 'text-indigo-800' },
    { key: 'fpo', label: 'FPO', value: users.filter((u) => u.role === 'fpo').length, cardClass: 'bg-emerald-50 border-emerald-200', labelClass: 'text-emerald-700', valueClass: 'text-emerald-800' },
    { key: 'miller', label: 'Miller', value: users.filter((u) => u.role === 'miller').length, cardClass: 'bg-cyan-50 border-cyan-200', labelClass: 'text-cyan-700', valueClass: 'text-cyan-800' },
    { key: 'financer', label: 'Financer', value: users.filter((u) => u.role === 'financer').length, cardClass: 'bg-sky-50 border-sky-200', labelClass: 'text-sky-700', valueClass: 'text-sky-800' },
    { key: 'admin', label: 'Admin', value: users.filter((u) => u.role === 'admin').length, cardClass: 'bg-rose-50 border-rose-200', labelClass: 'text-rose-700', valueClass: 'text-rose-800' },
    { key: 'super_admin', label: 'Super Admin', value: users.filter((u) => u.role === 'super_admin').length, cardClass: 'bg-violet-50 border-violet-200', labelClass: 'text-violet-700', valueClass: 'text-violet-800' },
  ];

  // Load PDF via backend proxy (uses signed view_access token so no auth header needed)
  useEffect(() => {
    const isPdf = viewerDoc?.file_name?.toLowerCase().endsWith('.pdf');
    if (!viewerDoc || !isPdf) {
      setPdfBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setPdfError(null);
      return;
    }
    let cancelled = false;
    const blobUrlRef = { current: null as string | null };
    setLoadingPdf(true);
    setPdfError(null);
    (async () => {
      try {
        // Prefer signed access token (works without Authorization header)
        const useAccessToken = viewerDoc.view_access;
        const proxyUrl = useAccessToken
          ? `${apiUrl}/documents/view?url=${encodeURIComponent(viewerDoc.view_url)}&access=${encodeURIComponent(viewerDoc.view_access!)}`
          : `${apiUrl}/admin/documents/view?url=${encodeURIComponent(viewerDoc.view_url)}`;
        const headers: Record<string, string> = { Accept: 'application/pdf,*/*' };
        if (!useAccessToken) {
          const token = localStorage.getItem('auth_token');
          if (token) headers.Authorization = `Bearer ${token}`;
        }
        const res = await fetch(proxyUrl, { headers });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const rawMessage = err.error || res.statusText || 'Failed to load PDF';
          let friendlyMessage = rawMessage;
          if (err.error === 'File blocked in Cloudinary' && err.message) {
            friendlyMessage = err.message;
          } else if (err.error === 'Invalid or expired view link' && err.message) {
            friendlyMessage = err.message;
          } else if (res.status === 401 || res.status === 403) {
            friendlyMessage = 'Link expired or invalid. Close and open the document again from the list.';
          }
          if (!cancelled) setPdfError(friendlyMessage);
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        if (blob.size === 0) {
          if (!cancelled) setPdfError('Document is empty. Try "Get fresh link" or open in new tab.');
          return;
        }
        const contentType = res.headers.get('content-type') || blob.type || '';
        const isPdfResponse = /pdf/.test(contentType) || /pdf/.test(blob.type);
        if (!isPdfResponse) {
          if (!cancelled) setPdfError('Response is not a PDF. Try "Get fresh link" or open in new tab.');
          return;
        }
        const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([await blob.arrayBuffer()], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(pdfBlob);
        blobUrlRef.current = blobUrl;
        setPdfBlobUrl(blobUrl);
      } catch (e: any) {
        if (!cancelled) setPdfError(e.message || 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoadingPdf(false);
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [viewerDoc?.view_url, viewerDoc?.view_access, viewerDoc?.file_name]);

  const handleApprove = async (userId: string) => {
    if (!canApproveUsers) {
      setError('Only Super Admin can approve user registration');
      return;
    }
    const id = typeof userId === 'string' ? userId.trim() : '';
    if (!id) return;
    setLoading(true);
    setError('');
    const patch = { approval_status: 'approved' as const, declined_reason: '' };
    const previousStatus = (users.find(u => getUserId(u) === id) as any)?.approval_status;
    const previousDeclinedReason = (users.find(u => getUserId(u) === id) as any)?.declined_reason ?? '';
    onUserUpdated?.(id, patch);
    if (selectedUser && getUserId(selectedUser) === id) setSelectedUser({ ...selectedUser, ...patch });
    try {
      await adminUpdateUser(id, { approval_status: 'approved', declined_reason: '' });
      onRefresh();
    } catch (e: any) {
      onUserUpdated?.(id, { approval_status: previousStatus ?? 'pending', declined_reason: previousDeclinedReason });
      if (selectedUser && getUserId(selectedUser) === id) {
        setSelectedUser(prev => prev
          ? { ...prev, approval_status: previousStatus ?? 'pending', declined_reason: previousDeclinedReason }
          : null);
      }
      setError(e.message || 'Failed to approve');
    }
    setLoading(false);
  };

  const handleDisapprove = async (userId: string, reasonInput: string) => {
    if (!canApproveUsers) {
      setError('Only Super Admin can decline user registration');
      return;
    }
    const id = typeof userId === 'string' ? userId.trim() : '';
    if (!id || id === 'undefined') {
      setDisapproveConfirmUserId(null);
      return;
    }
    const declineReason = String(reasonInput || '').trim();
    if (!declineReason) {
      setError('Decline reason is required');
      return;
    }
    setDisapproveConfirmUserId(null);
    setDeclineReasonDraft('');
    setLoading(true);
    setError('');
    const patch = { approval_status: 'rejected' as const, declined_reason: declineReason };
    // Optimistic update: update UI immediately so list/card updates without full refresh
    const previousStatus = (users.find(u => getUserId(u) === id) as any)?.approval_status;
    const previousDeclinedReason = (users.find(u => getUserId(u) === id) as any)?.declined_reason ?? '';
    onUserUpdated?.(id, patch);
    if (selectedUser && getUserId(selectedUser) === id) setSelectedUser({ ...selectedUser, ...patch });
    try {
      const updated = await adminUpdateUser(id, { approval_status: 'rejected', declined_reason: declineReason });
      const generatedLink = String(updated?.reentry_link || '').trim();
      if (generatedLink) {
        setReentryLinks((prev) => ({ ...prev, [id]: generatedLink }));
      }
      onRefresh(); // refetch in background to keep data in sync
    } catch (e: any) {
      // Revert on failure
      onUserUpdated?.(id, { approval_status: previousStatus ?? 'pending', declined_reason: previousDeclinedReason });
      if (selectedUser && getUserId(selectedUser) === id) {
        setSelectedUser(prev => prev
          ? { ...prev, approval_status: previousStatus ?? 'pending', declined_reason: previousDeclinedReason }
          : null);
      }
      setError(e.message || 'Failed to decline');
    }
    setLoading(false);
  };

  const activeUsers = users.filter((u: any) => (u?.approval_status || 'pending') !== 'rejected');
  const pendingUsers = users.filter(u => (u as any).approval_status === 'pending');
  const rejectedUsers = users.filter(u => (u as any).approval_status === 'rejected');

  const getUserId = (user: Profile | null): string => {
    if (!user) return '';
    const raw = (user as any).id ?? (user as any)._id;
    if (raw == null) return '';
    return typeof raw === 'string' ? raw.trim() : String(raw);
  };

  const copyToClipboard = async (text: string, successMessage = 'Link copied') => {
    try {
      await navigator.clipboard.writeText(text);
      await showAlert({ title: 'Copied', message: successMessage, tone: 'success' });
    } catch {
      await showAlert({
        title: 'Copy Link',
        message: 'Clipboard access is unavailable. Copy this link manually.',
        details: text,
        confirmText: 'Close',
        tone: 'info',
      });
    }
  };

  const handleGenerateReentryLink = async (userId: string) => {
    const id = String(userId || '').trim();
    if (!id) return;
    setGeneratingReentryLinkFor(id);
    setError('');
    try {
      const data = await adminGenerateReentryLink(id);
      const link = String(data?.reentry_link || '').trim();
      if (!link) {
        throw new Error('Link was not returned by server');
      }
      setReentryLinks((prev) => ({ ...prev, [id]: link }));
      await copyToClipboard(link, 'Re-entry link generated and copied');
    } catch (e: any) {
      setError(e.message || 'Failed to generate re-entry link');
    } finally {
      setGeneratingReentryLinkFor(null);
    }
  };

  const handleDeleteUser = async (user: Profile | null) => {
    const id = getUserId(user);
    if (!id) return;
    if (!canDeleteUsers) {
      setError('Only Admin or Super Admin can delete users');
      return;
    }
    if (currentUserId && id === String(currentUserId)) {
      setError('You cannot delete your own account while signed in');
      return;
    }

    const userName = user?.name || 'this user';
    const confirmed = await showConfirm({
      title: 'Delete User',
      message: `Delete ${userName}? This action cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      tone: 'danger',
    });
    if (!confirmed) return;

    setDeletingUserId(id);
    setError('');
    try {
      await adminDeleteUser(id);
      if (selectedUser && getUserId(selectedUser) === id) {
        setSelectedUser(null);
      }
      await onRefresh();
    } catch (e: any) {
      setError(e.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleExportApprovedUsers = () => {
    const approved = users.filter((u: any) => (u?.approval_status || 'pending') === 'approved');
    if (!approved.length) {
      void showAlert({
        title: 'No Approved Users',
        message: 'There are no approved users available to export right now.',
        tone: 'warning',
      });
      return;
    }
    const rows = approved.map((u) => ({
      Name: u.name || '',
      'Trade Name': u.trade_name || u.business_name || '',
      Role: u.role || '',
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Approved Users');
    const blob = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `approved-users-${new Date().toISOString().slice(0,10)}.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Fetch user verification document when user is selected
  useEffect(() => {
    const userId = getUserId(selectedUser);
    setShowPassword(false);
    setPasswordValue(null);
    setPasswordError(null);
    if (userId) {
      fetchUserDocument(userId);
    } else {
      setUserDocument(null);
    }
  }, [selectedUser]);

  const handleTogglePassword = async () => {
    if (!canApproveUsers) return;
    if (showPassword) {
      setShowPassword(false);
      return;
    }

    if (passwordValue) {
      setShowPassword(true);
      return;
    }

    const userId = getUserId(selectedUser);
    if (!userId) return;

    setLoadingPassword(true);
    setPasswordError(null);
    try {
      const data = await adminGetUserPassword(userId);
      setPasswordValue(data?.password || null);
      setShowPassword(true);
      if (!data?.available) {
        setPasswordError('Password not available for this user (older account).');
      }
    } catch (e: any) {
      setPasswordError(e.message || 'Failed to load password');
    } finally {
      setLoadingPassword(false);
    }
  };

  const fetchUserDocument = async (userId: string) => {
    if (!userId || userId === 'undefined') {
      setUserDocument(null);
      setLoadingDocument(false);
      return;
    }
    setLoadingDocument(true);
    try {
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`${apiUrl}/admin/users/${userId}/verification-document`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserDocument({ document: data.document, documents: data.documents || (data.document ? [data.document] : []), user: data.user });
        } else {
          setUserDocument(null);
        }
      } else {
        setUserDocument(null);
      }
    } catch (err) {
      console.error('Error fetching user document:', err);
      setUserDocument(null);
    } finally {
      setLoadingDocument(false);
    }
  };

  const handleGetFreshDocumentLink = async () => {
    const userId = getUserId(selectedUser);
    if (!userId || !viewerDoc) return;
    setPdfError(null);
    setLoadingPdf(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${apiUrl}/admin/users/${userId}/verification-document`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success && data.documents?.length) {
        const doc = data.documents.find((d: any) => d.view_url === viewerDoc.view_url) || data.document;
        if (doc?.view_access) {
          setViewerDoc({ ...viewerDoc, view_access: doc.view_access });
          return;
        }
      }
      if (res.ok && data.success && data.document?.view_access && data.document?.view_url === viewerDoc.view_url) {
        setViewerDoc({ ...viewerDoc, view_access: data.document.view_access });
        return;
      }
      setPdfError('Could not get a fresh link. Please close and open the document again from the list.');
    } catch {
      setPdfError('Could not get a fresh link. Please close and open the document again from the list.');
    } finally {
      setLoadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700 font-medium mb-1">Total Users</p>
            <p className="text-3xl font-bold text-blue-800">{activeUsers.length}</p>
          </div>
          {roleStats.map((stat) => (
            <div key={stat.key} className={`rounded-lg p-4 border ${stat.cardClass}`}>
              <p className={`text-sm font-medium mb-1 ${stat.labelClass}`}>{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.valueClass}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {/* New Users / Pending Approval – dedicated section */}
        {pendingUsers.length > 0 && (
          <div className="mb-6 rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setShowPendingSection((prev) => !prev)}
              className="w-full px-5 py-4 border-b border-amber-200 flex items-center justify-between flex-wrap gap-3 text-left hover:bg-amber-100/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-amber-700" />
                <h3 className="text-lg font-semibold text-amber-900">New Users</h3>
                <span className="px-2.5 py-0.5 text-sm font-medium rounded-full bg-amber-200 text-amber-900">
                  {pendingUsers.length} pending
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-amber-800">
                <span>Approve or disapprove access. Approved users can log in.</span>
                <span className="text-amber-900 font-semibold">{showPendingSection ? 'Collapse' : 'Expand'}</span>
              </div>
            </button>
            {showPendingSection && (
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingUsers.slice(0, 12).map((user, idx) => (
                    <div
                      key={getUserId(user) || user.name || `user-${idx}`}
                      className="bg-white rounded-lg border border-amber-100 p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email || (user as any).mobile_number}</p>
                          <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                        </div>
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        {canApproveUsers ? (
                          <>
                            <button
                              onClick={() => handleApprove(getUserId(user) || '')}
                              disabled={loading}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                            >
                              <ThumbsUp className="w-4 h-4" />
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                const id = getUserId(user);
                                if (!id) return;
                                setDeclineReasonDraft('');
                                setDisapproveConfirmUserId(id);
                              }}
                              disabled={loading}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg disabled:opacity-50"
                              title="Decline"
                            >
                              <ThumbsDown className="w-4 h-4" />
                              Decline
                            </button>
                          </>
                        ) : (
                          <p className="text-xs text-amber-800 bg-amber-100 px-2 py-2 rounded-lg w-full text-center">
                            Pending for Super Admin approval
                          </p>
                        )}
                        {canDeleteUsers && (
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={loading || deletingUserId === getUserId(user)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                            {deletingUserId === getUserId(user) ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {pendingUsers.length > 12 && (
                  <p className="text-sm text-amber-800 mt-3">+ {pendingUsers.length - 12} more in table below</p>
                )}
              </div>
            )}
          </div>
        )}

        {rejectedUsers.length > 0 && (
          <div className="mb-2 rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setShowRejectedSection((prev) => !prev)}
              className="w-full px-5 py-4 border-b border-red-200 flex items-center justify-between flex-wrap gap-3 text-left hover:bg-red-100/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Link2 className="w-6 h-6 text-red-700" />
                <h3 className="text-lg font-semibold text-red-900">Rejected Registrations</h3>
                <span className="px-2.5 py-0.5 text-sm font-medium rounded-full bg-red-200 text-red-900">
                  {rejectedUsers.length} rejected
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-red-800">
                <span>Generate re-entry links and share with users for correction.</span>
                <span className="text-red-900 font-semibold">{showRejectedSection ? 'Collapse' : 'Expand'}</span>
              </div>
            </button>
            {showRejectedSection && (
              <div className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rejectedUsers.slice(0, 9).map((user, idx) => {
                    const id = getUserId(user) || `rejected-${idx}`;
                    const link = reentryLinks[id];
                    return (
                      <div key={id} className="bg-white rounded-lg border border-red-100 p-4 shadow-sm">
                        <div className="mb-3">
                          <p className="font-medium text-gray-900 truncate">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email || (user as any).mobile_number}</p>
                          {(user as any).declined_reason && (
                            <p className="text-xs text-red-700 mt-1 line-clamp-2" title={(user as any).declined_reason}>
                              {(user as any).declined_reason}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {canGenerateReentryLink ? (
                            <button
                              type="button"
                              onClick={() => handleGenerateReentryLink(id)}
                              disabled={generatingReentryLinkFor === id}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                            >
                              <Link2 className="w-4 h-4" />
                              {generatingReentryLinkFor === id ? 'Generating...' : 'Generate Link'}
                            </button>
                          ) : (
                            <p className="flex-1 text-xs text-red-700 bg-red-100 px-2 py-2 rounded-lg text-center">
                              Admin access needed
                            </p>
                          )}
                          {canDeleteUsers && (
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              disabled={deletingUserId === getUserId(user)}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                              {deletingUserId === getUserId(user) ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedUser(user)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg"
                            title="View details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                        {link && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(link)}
                            className="mt-2 text-xs text-blue-700 hover:text-blue-800 underline break-all text-left"
                            title={link}
                          >
                            Copy latest link
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {rejectedUsers.length > 9 && (
                  <p className="text-sm text-red-800 mt-3">+ {rejectedUsers.length - 9} more in table below</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 pt-4 pb-2 flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name or trade name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2 items-center">
            <Filter className="text-gray-400 w-5 h-5" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Roles</option>
              <option value="farmer">Farmer</option>
              <option value="trader">Trader</option>
              <option value="fpo">FPO</option>
              <option value="corporate">Corporate</option>
              <option value="miller">Miller</option>
              <option value="financer">Financer</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <button
              type="button"
              onClick={handleExportApprovedUsers}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Approved
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trade Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user, idx) => (
                <tr key={getUserId(user) || user.name || `row-${idx}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-2">
                      {user.trade_name || user.business_name ? (
                        <>
                          <Building className="w-4 h-4 text-blue-600 mt-0.5" />
                          <span className="text-sm text-gray-900 break-words">
                            {user.trade_name || user.business_name}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                      user.role === 'super_admin' ? 'bg-violet-100 text-violet-800' :
                      user.role === 'admin' ? 'bg-red-100 text-red-800' :
                      user.role === 'farmer' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role === 'super_admin' ? 'Super Admin' : user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="p-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canDeleteUsers && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(user)}
                          disabled={deletingUserId === getUserId(user)}
                          className="p-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete user"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <User className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No users found</p>
            </div>
          )}
        </div>
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-800">User Management</h3>
                <button
                  onClick={() => {
                    setSelectedUser(null);
                    setError('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">User Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <p className="font-medium text-gray-900">{selectedUser.name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <p className="text-gray-900">{selectedUser.email || 'N/A'}</p>
                    </div>
                    {(userDocument?.user?.trade_name || (selectedUser as any).trade_name) && (
                      <div>
                        <span className="text-gray-600">Trade Name:</span>
                        <p className="text-gray-900">{userDocument?.user?.trade_name || (selectedUser as any).trade_name}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Password:</span>
                      {canApproveUsers ? (
                        <div className="mt-1">
                          <div className="flex items-center gap-2">
                            <p className="text-gray-900 font-mono">
                              {showPassword
                                ? (passwordValue || 'Not available')
                                : '••••••••'}
                            </p>
                            <button
                              type="button"
                              onClick={handleTogglePassword}
                              disabled={loadingPassword}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 text-gray-800 rounded disabled:opacity-50"
                            >
                              {showPassword ? (
                                <>
                                  <EyeOff className="w-3.5 h-3.5" />
                                  Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5" />
                                  {loadingPassword ? 'Loading...' : 'View'}
                                </>
                              )}
                            </button>
                          </div>
                          {passwordError && (
                            <p className="text-xs text-amber-700 mt-1">{passwordError}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-900 font-mono">•••••••• (visible to Super Admin only)</p>
                      )}
                    </div>
                    <div>
                      <span className="text-gray-600">Mobile Number:</span>
                      <p className="text-gray-900">{selectedUser.mobile_number || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Preferred Language:</span>
                      <p className="text-gray-900">{selectedUser.preferred_language || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Entity Type:</span>
                      <p className="capitalize text-gray-900">{selectedUser.entity_type || 'N/A'}</p>
                    </div>
                    {selectedUser.entity_type === 'company' && (
                      <>
                        <div>
                          <span className="text-gray-600">Business Name:</span>
                          <p className="font-medium text-gray-900">{selectedUser.business_name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Business Type:</span>
                          <p className="capitalize text-gray-900">
                            {selectedUser.business_type?.replace('_', ' ') || 'N/A'}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Address Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Address Line 1:</span>
                      <p className="text-gray-900">{selectedUser.address_line1 || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Address Line 2:</span>
                      <p className="text-gray-900">{selectedUser.address_line2 || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">District:</span>
                      <p className="text-gray-900">{selectedUser.district || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">State:</span>
                      <p className="text-gray-900">{selectedUser.state || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Country:</span>
                      <p className="text-gray-900">{selectedUser.country || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Pincode:</span>
                      <p className="text-gray-900">{selectedUser.pincode || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Account Status</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Current Role:</span>
                      <p className="capitalize font-medium text-gray-900">{selectedUser.role === 'super_admin' ? 'Super Admin' : (selectedUser.role || 'N/A')}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">KYC Status:</span>
                      <p className="capitalize font-medium text-gray-900">{selectedUser.kyc_status || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Approval Status:</span>
                      <p className="capitalize font-medium text-gray-900">{(selectedUser as any).approval_status ?? 'pending'}</p>
                    </div>
                    {(selectedUser as any).approval_status === 'rejected' && (selectedUser as any).declined_reason && (
                      <div>
                        <span className="text-gray-600">Decline Reason:</span>
                        <p className="text-red-700 font-medium">{(selectedUser as any).declined_reason}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">Created At:</span>
                      <p className="text-gray-900">{selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleString() : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Updated At:</span>
                      <p className="text-gray-900">{(selectedUser as any).updatedAt ? new Date((selectedUser as any).updatedAt).toLocaleString() : 'N/A'}</p>
                    </div>
                    {selectedUser.kyc_verified_at && (
                      <div>
                        <span className="text-gray-600">KYC Verified At:</span>
                        <p className="text-gray-900">{new Date(selectedUser.kyc_verified_at).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Uploaded Verification Document(s) */}
                {loadingDocument ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-500">Loading document(s)...</p>
                  </div>
                ) : userDocument?.documents?.length ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Uploaded Verification Documents ({userDocument.documents.length})
                    </h4>
                    <div className="space-y-4">
                      {userDocument.documents.map((doc: any, idx: number) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-white">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div>
                              <p className="font-medium text-gray-900">
                                {getDocumentTypeLabel(doc.document_type, (doc as { document_type_label?: string }).document_type_label)}
                              </p>
                              {doc.file_name && (
                                <p className="text-xs text-gray-600">{doc.file_name}</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              {doc.view_url && (
                                <button
                                  type="button"
                                  onClick={() => setViewerDoc({ view_url: doc.view_url, file_name: doc.file_name, document_type: doc.document_type, document_type_label: (doc as { document_type_label?: string }).document_type_label, view_access: (doc as { view_access?: string }).view_access })}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                                >
                                  <Eye className="w-4 h-4" />
                                  View
                                </button>
                              )}
                              {(doc.view_url && (doc as { view_access?: string }).view_access ? true : doc.download_url) && (
                                <a
                                  href={(doc as { view_access?: string }).view_access
                                    ? `${apiUrl}/documents/view?url=${encodeURIComponent(doc.view_url)}&access=${encodeURIComponent((doc as { view_access?: string }).view_access)}&download=1&filename=${encodeURIComponent(doc.file_name || 'document.pdf')}`
                                    : doc.download_url!}
                                  download={(doc.file_name || 'document.pdf').replace(/[^\w.-]/g, '_')}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                                >
                                  <Download className="w-4 h-4" />
                                  Download
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : userDocument?.document ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Uploaded Verification Document
                    </h4>
                    <div className="space-y-3">
                      <p className="font-medium text-gray-900">
                        {getDocumentTypeLabel(userDocument.document.document_type, (userDocument.document as { document_type_label?: string }).document_type_label)}
                      </p>
                      <div className="flex gap-2">
                        {userDocument.document.view_url && (
                          <button
                            type="button"
                            onClick={() => setViewerDoc({ view_url: userDocument.document.view_url, file_name: userDocument.document.file_name, document_type: userDocument.document.document_type, document_type_label: (userDocument.document as { document_type_label?: string }).document_type_label, view_access: (userDocument.document as { view_access?: string }).view_access })}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                          >
                            <Eye className="w-4 h-4" /> View
                          </button>
                        )}
                        {(userDocument.document.view_url && (userDocument.document as { view_access?: string }).view_access) || userDocument.document.download_url ? (
                          <a
                            href={(userDocument.document as { view_access?: string }).view_access
                              ? `${apiUrl}/documents/view?url=${encodeURIComponent(userDocument.document.view_url)}&access=${encodeURIComponent((userDocument.document as { view_access?: string }).view_access)}&download=1&filename=${encodeURIComponent(userDocument.document.file_name || 'document.pdf')}`
                              : userDocument.document.download_url!}
                            download={(userDocument.document.file_name || 'document.pdf').replace(/[^\w.-]/g, '_')}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
                          >
                            <Download className="w-4 h-4" /> Download
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : !loadingDocument ? (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Uploaded Verification Document
                    </h4>
                    <p className="text-gray-500 text-sm">No document uploaded by this user.</p>
                  </div>
                ) : null}

                {/* Old Verification Documents (from Cashfree/Aadhaar) */}
                {(selectedUser as any).verification_documents && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-3">Verification Documents (Legacy)</h4>
                    <div className="space-y-2 text-sm">
                      {(selectedUser as any).verification_documents?.aadhaar_number && (
                        <div>
                          <span className="text-gray-600">Aadhaar Number:</span>
                          <p className="text-gray-900 font-mono">{(selectedUser as any).verification_documents.aadhaar_number}</p>
                        </div>
                      )}
                      {(selectedUser as any).verification_documents?.pan_number && (
                        <div>
                          <span className="text-gray-600">PAN Number:</span>
                          <p className="text-gray-900 font-mono">{(selectedUser as any).verification_documents.pan_number}</p>
                        </div>
                      )}
                      {(selectedUser as any).verification_documents?.gstin && (
                        <div>
                          <span className="text-gray-600">GSTIN:</span>
                          <p className="text-gray-900 font-mono">{(selectedUser as any).verification_documents.gstin}</p>
                        </div>
                      )}
                      {(selectedUser as any).verification_documents?.cin && (
                        <div>
                          <span className="text-gray-600">Incorporation Certificate (CIN):</span>
                          <p className="text-gray-900 font-mono">{(selectedUser as any).verification_documents.cin}</p>
                        </div>
                      )}
                      {!(selectedUser as any).verification_documents?.aadhaar_number && 
                       !(selectedUser as any).verification_documents?.pan_number && 
                       !(selectedUser as any).verification_documents?.gstin && 
                       !(selectedUser as any).verification_documents?.cin && (
                        <p className="text-gray-500">No verification documents</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedUser.kyc_data && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    KYC Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Verification Type:</span>
                      <p className="font-medium text-gray-900 capitalize">
                        {selectedUser.kyc_data.verificationType?.replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Document Number:</span>
                      <p className="font-mono text-gray-900">{selectedUser.kyc_data.documentNumber}</p>
                    </div>
                    {selectedUser.kyc_data.verifiedAt && (
                      <div>
                        <span className="text-gray-600">Verified At:</span>
                        <p className="text-gray-900">{new Date(selectedUser.kyc_data.verifiedAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {canDeleteUsers && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delete User
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(selectedUser)}
                      disabled={deletingUserId === getUserId(selectedUser)}
                      className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deletingUserId === getUserId(selectedUser) ? 'Deleting user...' : 'Delete User'}
                    </button>
                    {currentUserId && getUserId(selectedUser) === String(currentUserId) && (
                      <p className="text-xs text-amber-700 mt-2">
                        Your own signed-in account cannot be deleted from this panel.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Approval
                  </label>
                  {canApproveUsers ? (
                    <>
                      {(selectedUser as any).approval_status === 'pending' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(getUserId(selectedUser) || '')}
                            disabled={loading}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <ThumbsUp className="w-4 h-4" />
                            Approve (sends email if they have one)
                          </button>
                          <button
                            onClick={() => {
                              const id = getUserId(selectedUser);
                              if (!id) return;
                              setDeclineReasonDraft('');
                              setDisapproveConfirmUserId(id);
                            }}
                            disabled={loading}
                            className="flex-1 bg-amber-100 hover:bg-amber-200 text-amber-800 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <ThumbsDown className="w-4 h-4" />
                            Decline
                          </button>
                        </div>
                      ) : (selectedUser as any).approval_status === 'approved' ? (
                        <p className="text-sm text-green-800 bg-green-100 px-3 py-2 rounded-lg">
                          This registration is approved. Decision is locked.
                        </p>
                      ) : (
                        <p className="text-sm text-red-800 bg-red-100 px-3 py-2 rounded-lg">
                          This registration is declined. Decision is locked until Admin re-submits.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-amber-800 bg-amber-100 px-3 py-2 rounded-lg">
                      Only Super Admin can approve or decline user registration.
                    </p>
                  )}
                </div>

                {(selectedUser as any).approval_status === 'rejected' && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-medium text-red-900">Re-Entry Link</p>
                        <p className="text-xs text-red-800">Share this link with user to refill and re-submit registration.</p>
                      </div>
                      {canGenerateReentryLink ? (
                        <button
                          type="button"
                          onClick={() => handleGenerateReentryLink(getUserId(selectedUser))}
                          disabled={generatingReentryLinkFor === getUserId(selectedUser)}
                          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                        >
                          <Link2 className="w-4 h-4" />
                          {generatingReentryLinkFor === getUserId(selectedUser) ? 'Generating...' : 'Generate Link'}
                        </button>
                      ) : null}
                    </div>
                    {reentryLinks[getUserId(selectedUser)] && (
                      <div className="mt-2 flex items-center gap-2">
                        <p className="text-xs text-gray-700 break-all">{reentryLinks[getUserId(selectedUser)]}</p>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(reentryLinks[getUserId(selectedUser)])}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white border border-gray-200 rounded hover:bg-gray-50"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document viewer popup – opens image/PDF inside admin panel */}
      {viewerDoc && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70"
          onClick={() => setViewerDoc(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700 truncate">
                {viewerDoc.file_name || getDocumentTypeLabel(viewerDoc.document_type || '', viewerDoc.document_type_label)}
              </span>
              <button
                type="button"
                onClick={() => setViewerDoc(null)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                aria-label="Close"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-4 overflow-auto bg-gray-100">
              {viewerDoc.file_name?.toLowerCase().endsWith('.pdf') ? (
                <>
                  {loadingPdf && (
                    <div className="flex items-center justify-center h-[75vh] text-gray-500">
                      Loading PDF…
                    </div>
                  )}
                  {pdfError && (
                    <div className="flex flex-col items-center justify-center h-[75vh] gap-3 text-red-600 max-w-md text-center">
                      <p>{pdfError}</p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={handleGetFreshDocumentLink}
                          disabled={loadingPdf || !getUserId(selectedUser)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                        >
                          {loadingPdf ? 'Loading…' : 'Get fresh link'}
                        </button>
                        <a
                          href={viewerDoc.view_access
                            ? `${apiUrl}/documents/view?url=${encodeURIComponent(viewerDoc.view_url)}&access=${encodeURIComponent(viewerDoc.view_access)}`
                            : viewerDoc.view_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 text-blue-600 hover:underline text-sm"
                        >
                          Open in new tab
                        </a>
                      </div>
                    </div>
                  )}
                  {!loadingPdf && !pdfError && pdfBlobUrl && (
                    <iframe
                      src={pdfBlobUrl}
                      title="Document"
                      className="w-full h-[75vh] border-0 rounded-lg bg-white"
                    />
                  )}
                  <p className="text-center mt-2 text-sm text-gray-600">
                    If the PDF doesn’t display above,{' '}
                    <a
                      href={viewerDoc.view_access
                        ? `${apiUrl}/documents/view?url=${encodeURIComponent(viewerDoc.view_url)}&access=${encodeURIComponent(viewerDoc.view_access)}`
                        : viewerDoc.view_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      open in new tab
                    </a>
                  </p>
                </>
              ) : (
                <img
                  src={viewerDoc.view_url}
                  alt="Document"
                  className="max-w-full max-h-[75vh] w-auto h-auto object-contain mx-auto rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disapprove confirmation modal */}
      {disapproveConfirmUserId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => {
            setDisapproveConfirmUserId(null);
            setDeclineReasonDraft('');
          }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Decline user?</h3>
            <p className="text-gray-600 mb-4">Add decline reason. After decline, decision will be locked until Admin re-submits.</p>
            <textarea
              value={declineReasonDraft}
              onChange={(e) => setDeclineReasonDraft(e.target.value)}
              placeholder="Enter decline reason..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setDisapproveConfirmUserId(null);
                  setDeclineReasonDraft('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (disapproveConfirmUserId) {
                    handleDisapprove(disapproveConfirmUserId, declineReasonDraft);
                  }
                }}
                disabled={loading || !disapproveConfirmUserId || !declineReasonDraft.trim()}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
