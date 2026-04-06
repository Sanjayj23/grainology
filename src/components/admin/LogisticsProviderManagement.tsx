import { useState, useEffect, useMemo } from 'react';
import { Truck, Plus, Edit2, Trash2, Search, MapPin, Phone, Mail } from 'lucide-react';
import { api } from '../../lib/client';
import {
  buildLogisticsFilterOptions,
  deriveLocationCombinationsFromProviders,
  filterLogisticsProviders,
  type LogisticsLocationCombination
} from '../../lib/logisticsFilters';

interface LogisticsProvider {
  id: string;
  company_name: string;
  mobile_number: string;
  email: string;
  address: string;
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
  is_active?: boolean;
}

export default function LogisticsProviderManagement() {
  const [providers, setProviders] = useState<LogisticsProvider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<LogisticsProvider[]>([]);
  const [locationCombinations, setLocationCombinations] = useState<LogisticsLocationCombination[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<LogisticsProvider | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [searchCompany, setSearchCompany] = useState('');
  const [searchDistrict, setSearchDistrict] = useState('');
  const [searchState, setSearchState] = useState('');
  const [searchCountry, setSearchCountry] = useState('');
  const [searchPincode, setSearchPincode] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [pincode, setPincode] = useState('');

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    setFilteredProviders(
      filterLogisticsProviders(providers, {
        search: searchCompany,
        district: searchDistrict,
        state: searchState,
        country: searchCountry,
        pincode: searchPincode
      })
    );
  }, [providers, searchCompany, searchDistrict, searchState, searchCountry, searchPincode]);

  const filterOptions = useMemo(() => {
    const combinations = locationCombinations.length > 0
      ? locationCombinations
      : deriveLocationCombinationsFromProviders(providers);

    return buildLogisticsFilterOptions(combinations);
  }, [locationCombinations, providers]);

  const loadProviders = async () => {
    const { data, error } = await api
      .from('logistics_providers')
      .select('*')
      .order('company_name', { ascending: true });

    if (!error && data) {
      const providerList = Array.isArray(data) ? data : [];
      setProviders(providerList);
      await loadLocationCombinations(providerList);
    } else {
      setProviders([]);
      setLocationCombinations([]);
    }
  };

  const loadLocationCombinations = async (providerList: LogisticsProvider[]) => {
    const fallbackCombinations = deriveLocationCombinationsFromProviders(providerList);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/logistics/filter-options`);

      if (!response.ok) {
        throw new Error('Failed to fetch logistics filter options');
      }

      const result = await response.json();
      if (Array.isArray(result?.combinations) && result.combinations.length > 0) {
        setLocationCombinations(result.combinations);
        return;
      }
    } catch (fetchError) {
      console.error('Failed to load logistics filter options:', fetchError);
    }

    setLocationCombinations(fallbackCombinations);
  };

  const resetForm = () => {
    setCompanyName('');
    setMobileNumber('');
    setEmail('');
    setAddress('');
    setDistrict('');
    setState('');
    setCountry('India');
    setPincode('');
    setEditingProvider(null);
    setShowForm(false);
    setError('');
    setSuccess('');
  };

  const handleEdit = (provider: LogisticsProvider) => {
    setEditingProvider(provider);
    setCompanyName(provider.company_name);
    setMobileNumber(provider.mobile_number);
    setEmail(provider.email || '');
    setAddress(provider.address || '');
    setDistrict(provider.district || '');
    setState(provider.state || '');
    setCountry(provider.country || 'India');
    setPincode(provider.pincode || '');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!companyName.trim() || !mobileNumber.trim() || !address.trim()) {
      setError('Logistics Provider Name, Number aur Address zaroori hain');
      return;
    }

    setLoading(true);

    try {
      const providerData = {
        company_name: companyName.trim(),
        mobile_number: mobileNumber.trim(),
        email: (email || '').trim(),
        address: address.trim(),
        district: district.trim(),
        state: state.trim(),
        country: country.trim() || 'India',
        pincode: pincode.trim(),
        is_active: true,
      };

      if (editingProvider) {
        const { error: updateError } = await api
          .from('logistics_providers')
          .update(providerData)
          .eq('id', editingProvider.id);

        if (updateError) throw updateError;
        setSuccess('Provider update ho gaya!');
      } else {
        const { error: insertError } = await api
          .from('logistics_providers')
          .insert(providerData);

        if (insertError) throw insertError;
        setSuccess('Provider add ho gaya!');
      }

      await loadProviders();
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Save fail. Dubara try karein.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Is provider ko delete karna hai?')) return;

    const { error } = await api
      .from('logistics_providers')
      .delete()
      .eq('id', id);

    if (!error) {
      setSuccess('Provider delete ho gaya');
      await loadProviders();
    } else {
      setError('Delete fail. Dubara try karein.');
    }
  };

  const hasActiveFilters = [searchCompany, searchDistrict, searchState, searchCountry, searchPincode].some((value) => value.trim());
  const list = hasActiveFilters ? filteredProviders : providers;

  return (
    <div className="space-y-6">
      <div className="bg-yellow-100 border-l-4 border-yellow-600 p-4">
        <h2 className="text-xl font-bold text-gray-900">7. Logistics</h2>
        <p className="text-sm text-gray-700 mt-1">
          Logistics providers ko yahan add karein. Address ke saath district, state, country aur pincode bhi maintain karein.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Logistics Provider Management</h3>
              <p className="text-sm text-gray-600">Add / Edit / Delete logistics providers</p>
            </div>
          </div>

          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Logistics Provider
          </button>
        </div>

        {/* Search */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-5 h-5 text-gray-600" />
            <h4 className="font-semibold text-gray-900">Search</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Provider / Company Name</label>
              <input
                type="text"
                value={searchCompany}
                onChange={(e) => setSearchCompany(e.target.value)}
                placeholder="Company name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
              <select
                value={searchDistrict}
                onChange={(e) => setSearchDistrict(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">District</option>
                {filterOptions.districts.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <select
                value={searchState}
                onChange={(e) => setSearchState(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">State</option>
                {filterOptions.states.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                value={searchCountry}
                onChange={(e) => setSearchCountry(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="">Country</option>
                {filterOptions.countries.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
              <select
                value={searchPincode}
                onChange={(e) => setSearchPincode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
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
        </div>

        {/* Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="mb-8 p-6 bg-gray-50 rounded-lg border-2 border-green-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              {editingProvider ? 'Edit Logistics Provider' : 'Add New Logistics Provider'}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logistics Provider Name *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                  placeholder="e.g. Bihar Transport Services"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number *</label>
                <input
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                  placeholder="e.g. +91 9876543210"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  rows={2}
                  placeholder="Complete address with city and pincode"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Patna"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. Bihar"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. India"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 800001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

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

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingProvider ? 'Update Provider' : 'Add Provider'}
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

        {/* Providers List - sirf name, number, email, address + Edit/Delete */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((provider) => (
            <div key={provider.id} className="bg-white border-2 border-gray-300 rounded-lg p-4 hover:shadow-lg transition-shadow">
              <div className="mb-3">
                <h4 className="font-bold text-lg text-gray-900">{provider.company_name}</h4>
              </div>

              <div className="space-y-2 mb-3 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <Phone className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>{provider.mobile_number}</span>
                </div>
                {provider.email && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Mail className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="truncate">{provider.email}</span>
                  </div>
                )}
                <div className="flex items-start gap-2 text-gray-700">
                  <MapPin className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p>{provider.address}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {[provider.district, provider.state, provider.country, provider.pincode].filter(Boolean).join(', ') || 'Address details not added'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => handleEdit(provider)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(provider.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}

          {list.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              {searchCompany
                ? 'Koi provider is naam se nahi mila.'
                : 'Abhi koi logistics provider add nahi hai. Upar se add karein.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
