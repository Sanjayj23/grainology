import { useEffect, useState } from 'react';
import { Copy, Mail, MessageSquare, Phone, RefreshCw, User } from 'lucide-react';
import { api } from '../../lib/client';

type ContactInquiry = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  created_at: string;
};

export default function ContactInquiriesPanel() {
  const [inquiries, setInquiries] = useState<ContactInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  const loadInquiries = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await api.request('/contact-inquiries');
      setInquiries(Array.isArray(data) ? data : []);
    } catch (loadError: any) {
      setError(loadError?.error || loadError?.message || 'Failed to load contact inquiries.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInquiries();
  }, []);

  const copyPhoneNumber = async (phone: string) => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      setCopyMessage(`Copied ${phone}`);
      window.setTimeout(() => setCopyMessage(''), 2000);
    } catch {
      setCopyMessage('Unable to copy number');
      window.setTimeout(() => setCopyMessage(''), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-slate-900">Contact Form Submissions</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Latest submissions appear first. Admin and Super Admin can review contact requests and copy submitted phone numbers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadInquiries()}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {copyMessage && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {copyMessage}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}
      </div>

      <div className="grid gap-5">
        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            Loading contact inquiries...
          </div>
        )}

        {!loading && inquiries.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            No contact form submissions yet.
          </div>
        )}

        {!loading &&
          inquiries.map((inquiry) => (
            <div key={inquiry.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="flex items-start gap-3">
                    <User className="mt-1 h-5 w-5 text-emerald-700" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Name</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">{inquiry.name}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="mt-1 h-5 w-5 text-emerald-700" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Email</p>
                      <p className="mt-1 text-sm font-medium text-slate-900 break-all">{inquiry.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="mt-1 h-5 w-5 text-emerald-700" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Phone</p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{inquiry.phone || 'Not provided'}</p>
                        {inquiry.phone && (
                          <button
                            type="button"
                            onClick={() => void copyPhoneNumber(inquiry.phone || '')}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MessageSquare className="mt-1 h-5 w-5 text-emerald-700" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Received</p>
                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {new Date(inquiry.created_at).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Subject</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{inquiry.subject}</p>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{inquiry.message}</p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
