import { useEffect, useState } from 'react';
import { api } from './client';
import { getCachedData, setCachedData } from './sessionStorage';

export type SiteStat = {
  value: number;
  prefix: string;
  suffix: string;
  label: string;
  text: string;
};

export type ContactDetail = {
  key: string;
  title: string;
  lines: string[];
};

export type BusinessHours = {
  heading: string;
  primary: string;
  secondary: string;
};

export type SiteSettings = {
  contactDetails: ContactDetail[];
  businessHours: BusinessHours;
  homepageStats: SiteStat[];
};

export const defaultSiteSettings: SiteSettings = {
  contactDetails: [
    { key: 'email', title: 'Email', lines: ['support@grainology.com', 'info@grainology.com'] },
    { key: 'phone', title: 'Phone', lines: ['+91 1800-XXX-XXXX', '+91 1800-XXX-XXXX (Toll Free)'] },
    { key: 'address', title: 'Address', lines: ['India'] }
  ],
  businessHours: {
    heading: 'Business hours',
    primary: 'Monday to Friday: 9:00 AM to 6:00 PM',
    secondary: 'Saturday: 10:00 AM to 4:00 PM'
  },
  homepageStats: [
    {
      value: 50,
      prefix: '',
      suffix: 'K+',
      label: 'Active Users',
      text: 'A growing network of platform participants uses Grainology for trade discovery, workflows, and operations.'
    },
    {
      value: 500,
      prefix: '₹',
      suffix: 'Cr+',
      label: 'Trade Volume',
      text: 'Trade activity across the platform reflects large-scale commodity movement and recurring business usage.'
    },
    {
      value: 1000,
      prefix: '',
      suffix: '+',
      label: 'Cities Covered',
      text: 'Users can engage with Grainology across a wide geographic footprint spanning multiple agricultural markets.'
    },
    {
      value: 24,
      prefix: '',
      suffix: '/7',
      label: 'Support',
      text: 'Teams can rely on continuous assistance for platform operations, onboarding, and issue resolution.'
    }
  ]
};

const SITE_SETTINGS_CACHE_KEY = 'cache_site_settings_public';
const SITE_SETTINGS_TTL_MS = 5 * 60 * 1000;
const SITE_SETTINGS_VERSION_KEY = 'site_settings_version';
const SITE_SETTINGS_UPDATED_EVENT = 'site-settings-updated';

function normalizeSiteSettings(input: any): SiteSettings {
  const normalizeStatValue = (stat: any) => {
    const rawValue = Number(stat?.value) || 0;
    const divisor = Math.max(1, Number(stat?.divisor) || 1);
    return divisor > 1 ? Math.round(rawValue / divisor) : rawValue;
  };

  return {
    contactDetails: Array.isArray(input?.contactDetails) && input.contactDetails.length > 0
      ? input.contactDetails.map((item: any, index: number) => ({
          key: String(item?.key || ['email', 'phone', 'address'][index] || `item-${index + 1}`),
          title: String(item?.title || `Item ${index + 1}`),
          lines: Array.isArray(item?.lines) ? item.lines.map((line: any) => String(line || '')).filter(Boolean) : []
        }))
      : defaultSiteSettings.contactDetails,
    businessHours: {
      heading: String(input?.businessHours?.heading || defaultSiteSettings.businessHours.heading),
      primary: String(input?.businessHours?.primary || defaultSiteSettings.businessHours.primary),
      secondary: String(input?.businessHours?.secondary || defaultSiteSettings.businessHours.secondary)
    },
    homepageStats: Array.isArray(input?.homepageStats) && input.homepageStats.length > 0
      ? input.homepageStats.map((stat: any, index: number) => ({
          value: normalizeStatValue(stat),
          prefix: String(stat?.prefix || ''),
          suffix: String(stat?.suffix || ''),
          label: String(stat?.label || `Stat ${index + 1}`),
          text: String(stat?.text || '')
        }))
      : defaultSiteSettings.homepageStats
  };
}

export async function fetchSiteSettings(force = false): Promise<SiteSettings> {
  if (!force) {
    const cached = getCachedData<SiteSettings>(SITE_SETTINGS_CACHE_KEY, SITE_SETTINGS_TTL_MS);
    if (cached) {
      return normalizeSiteSettings(cached);
    }
  }

  const data = await api.request('/site-settings');
  const normalized = normalizeSiteSettings(data);
  setCachedData(SITE_SETTINGS_CACHE_KEY, normalized);
  return normalized;
}

export async function updateSiteSettings(settings: SiteSettings): Promise<SiteSettings> {
  const data = await api.request('/site-settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  });
  const normalized = normalizeSiteSettings(data);
  setCachedData(SITE_SETTINGS_CACHE_KEY, normalized);
  if (typeof window !== 'undefined') {
    const version = String(Date.now());
    localStorage.setItem(SITE_SETTINGS_VERSION_KEY, version);
    window.dispatchEvent(
      new CustomEvent(SITE_SETTINGS_UPDATED_EVENT, {
        detail: normalized
      })
    );
  }
  return normalized;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async (force = false) => {
      try {
        const nextSettings = await fetchSiteSettings(force);
        if (active) {
          setSettings(nextSettings);
        }
      } catch (error) {
        console.error('Failed to load site settings:', error);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    const handleSettingsUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<SiteSettings | undefined>;
      if (customEvent.detail) {
        setSettings(normalizeSiteSettings(customEvent.detail));
        setLoading(false);
        return;
      }

      void load(true);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SITE_SETTINGS_VERSION_KEY) {
        void load(true);
      }
    };

    window.addEventListener(SITE_SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      active = false;
      window.removeEventListener(SITE_SETTINGS_UPDATED_EVENT, handleSettingsUpdated as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return { settings, loading, setSettings };
}

export function getContactDetail(settings: SiteSettings, key: string) {
  return settings.contactDetails.find((item) => item.key === key);
}
