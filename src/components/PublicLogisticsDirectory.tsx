import { useEffect, useMemo, useState } from 'react';
import { MapPin, Phone, Mail, Search, Truck } from 'lucide-react';
import {
  buildLogisticsFilterOptions,
  deriveLocationCombinationsFromProviders,
  filterLogisticsProviders,
  type LogisticsLocationCombination
} from '../lib/logisticsFilters';

type LogisticsProvider = {
  id: string;
  company_name: string;
  mobile_number: string;
  email?: string;
  address: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
  is_active?: boolean;
};

export default function PublicLogisticsDirectory() {
  const [providers, setProviders] = useState<LogisticsProvider[]>([]);
  const [locationCombinations, setLocationCombinations] = useState<LogisticsLocationCombination[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [pincode, setPincode] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const [providersResult, optionsResult] = await Promise.allSettled([
          fetch(`${apiUrl}/logistics?is_active=true`),
          fetch(`${apiUrl}/logistics/filter-options`)
        ]);

        if (providersResult.status !== 'fulfilled' || !providersResult.value.ok) {
          throw new Error('Failed to fetch logistics providers');
        }

        const data = await providersResult.value.json();
        const providerList = Array.isArray(data) ? data : [];
        let combinations = deriveLocationCombinationsFromProviders(providerList);

        if (optionsResult.status === 'fulfilled' && optionsResult.value.ok) {
          const optionsData = await optionsResult.value.json();
          if (Array.isArray(optionsData?.combinations) && optionsData.combinations.length > 0) {
            combinations = optionsData.combinations;
          }
        }

        if (active) {
          setProviders(providerList);
          setLocationCombinations(combinations);
        }
      } catch (error) {
        if (active) {
          setProviders([]);
          setLocationCombinations([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const filteredProviders = useMemo(() => {
    return filterLogisticsProviders(providers, { search, district, state, country, pincode });
  }, [country, district, pincode, providers, search, state]);

  const filterOptions = useMemo(() => {
    const combinations = locationCombinations.length > 0
      ? locationCombinations
      : deriveLocationCombinationsFromProviders(providers);

    return buildLogisticsFilterOptions(combinations);
  }, [locationCombinations, providers]);

  return (
    <section className="bg-white px-4 py-20 lg:px-8">
      <div className="mx-auto max-w-[94rem]">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Logistics network</p>
          <h2 className="mt-4 font-serif text-4xl text-stone-900 sm:text-5xl">
            Find active Grainology logistics providers by region
          </h2>
          <p className="mt-5 text-lg leading-8 text-stone-700">
            Explore provider contact details with filters for district, state, country, and pincode before planning dispatch or delivery operations.
          </p>
        </div>

        <div className="mt-10 rounded-[32px] border border-stone-200 bg-[#f6f1e7] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-6">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Company or address"
                className="w-full rounded-2xl border border-stone-300 bg-white py-3 pl-10 pr-4 text-sm text-stone-700 outline-none transition focus:border-emerald-500"
              />
            </div>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-emerald-500"
            >
              <option value="">Country</option>
              {filterOptions.countries.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-emerald-500"
            >
              <option value="">State</option>
              {filterOptions.states.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-emerald-500"
            >
              <option value="">District</option>
              {filterOptions.districts.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700 outline-none transition focus:border-emerald-500"
            >
              <option value="">Pincode</option>
              {filterOptions.pincodes.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-[28px] border border-stone-200 bg-stone-100" />
            ))}
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="mt-10 rounded-[28px] border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center text-stone-500">
            No logistics providers match the current filters.
          </div>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProviders.map((provider) => (
              <article
                key={provider.id}
                className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-2xl font-semibold text-stone-900">{provider.company_name}</p>
                    <p className="mt-2 text-sm text-stone-500">
                      {[provider.district, provider.state, provider.country].filter(Boolean).join(', ') || 'Regional details available on request'}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Truck className="h-6 w-6" />
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-sm text-stone-700">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-emerald-700" />
                    <a href={`tel:${provider.mobile_number}`} className="hover:text-emerald-700">
                      {provider.mobile_number}
                    </a>
                  </div>
                  {provider.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-emerald-700" />
                      <a href={`mailto:${provider.email}`} className="truncate hover:text-emerald-700">
                        {provider.email}
                      </a>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-emerald-700" />
                    <div>
                      <p>{provider.address}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {[provider.district, provider.state, provider.country, provider.pincode].filter(Boolean).join(', ') || 'Address details not added'}
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
