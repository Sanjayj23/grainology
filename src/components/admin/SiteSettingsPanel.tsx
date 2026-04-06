import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { defaultSiteSettings, fetchSiteSettings, type SiteSettings, updateSiteSettings } from '../../lib/siteSettings';

export default function SiteSettingsPanel() {
  const [formState, setFormState] = useState<SiteSettings>(defaultSiteSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const settings = await fetchSiteSettings(true);
        if (active) {
          setFormState(settings);
        }
      } catch (loadError: any) {
        if (active) {
          setError(loadError?.error || loadError?.message || 'Failed to load site settings.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const updateContactLine = (detailIndex: number, lineIndex: number, value: string) => {
    setFormState((prev) => ({
      ...prev,
      contactDetails: prev.contactDetails.map((detail, index) =>
        index === detailIndex
          ? {
              ...detail,
              lines: detail.lines.map((line, currentLineIndex) => (currentLineIndex === lineIndex ? value : line))
            }
          : detail
      )
    }));
  };

  const updateContactTitle = (detailIndex: number, value: string) => {
    setFormState((prev) => ({
      ...prev,
      contactDetails: prev.contactDetails.map((detail, index) =>
        index === detailIndex ? { ...detail, title: value } : detail
      )
    }));
  };

  const updateBusinessHours = (field: 'heading' | 'primary' | 'secondary', value: string) => {
    setFormState((prev) => ({
      ...prev,
      businessHours: {
        ...prev.businessHours,
        [field]: value
      }
    }));
  };

  const updateStat = (statIndex: number, field: 'value' | 'prefix' | 'suffix' | 'label' | 'text', value: string) => {
    setFormState((prev) => ({
      ...prev,
      homepageStats: prev.homepageStats.map((stat, index) =>
        index === statIndex
          ? {
              ...stat,
              [field]: field === 'value' ? Number(value) || 0 : value
            }
          : stat
      )
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const saved = await updateSiteSettings(formState);
      setFormState(saved);
      setMessage('Website contact details and shared stats updated successfully.');
    } catch (saveError: any) {
      setError(saveError?.error || saveError?.message || 'Failed to save site settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">Loading site settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-slate-900">Website Settings</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Control shared contact information and stats used across the public website.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {message && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>}
        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-xl font-semibold text-slate-900">Contact Information</h4>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {formState.contactDetails.map((detail, detailIndex) => (
            <div key={detail.key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="block text-sm font-medium text-slate-700">Card Title</label>
              <input
                value={detail.title}
                onChange={(event) => updateContactTitle(detailIndex, event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              />
              <div className="mt-4 space-y-3">
                {detail.lines.map((line, lineIndex) => (
                  <div key={`${detail.key}-${lineIndex}`}>
                    <label className="block text-sm font-medium text-slate-700">Line {lineIndex + 1}</label>
                    <input
                      value={line}
                      onChange={(event) => updateContactLine(detailIndex, lineIndex, event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-xl font-semibold text-slate-900">Business Hours</h4>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Heading</label>
            <input
              value={formState.businessHours.heading}
              onChange={(event) => updateBusinessHours('heading', event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Primary line</label>
            <input
              value={formState.businessHours.primary}
              onChange={(event) => updateBusinessHours('primary', event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Secondary line</label>
            <input
              value={formState.businessHours.secondary}
              onChange={(event) => updateBusinessHours('secondary', event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h4 className="text-xl font-semibold text-slate-900">Shared Stats</h4>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          These values are reused across the website wherever the public business stats section appears.
        </p>

        <div className="mt-6 space-y-5">
          {formState.homepageStats.map((stat, statIndex) => (
            <div key={statIndex} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Visible number</label>
                  <input
                    type="number"
                    value={stat.value}
                    onChange={(event) => updateStat(statIndex, 'value', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Prefix</label>
                  <input
                    value={stat.prefix}
                    onChange={(event) => updateStat(statIndex, 'prefix', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Suffix</label>
                  <input
                    value={stat.suffix}
                    onChange={(event) => updateStat(statIndex, 'suffix', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Label</label>
                  <input
                    value={stat.label}
                    onChange={(event) => updateStat(statIndex, 'label', event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={stat.text}
                  onChange={(event) => updateStat(statIndex, 'text', event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
