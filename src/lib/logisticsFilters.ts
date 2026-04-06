export type LogisticsLocationCombination = {
  district?: string;
  state?: string;
  country?: string;
  pincode?: string;
};

export type LogisticsFilterState = {
  search: string;
  district: string;
  state: string;
  country: string;
  pincode: string;
};

type LogisticsProviderFilterable = LogisticsLocationCombination & {
  company_name: string;
  address: string;
};

const normalizeText = (value?: string) => String(value || '').trim();
const normalizeLower = (value?: string) => normalizeText(value).toLowerCase();

const uniqueSorted = (values: string[]) => (
  Array.from(new Set(values.map(normalizeText).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
);

const sameValue = (left?: string, right?: string) => normalizeLower(left) === normalizeLower(right);

export function deriveLocationCombinationsFromProviders<T extends LogisticsLocationCombination>(providers: T[]) {
  const records = new Map<string, LogisticsLocationCombination>();

  providers.forEach((provider) => {
    const district = normalizeText(provider.district);
    const state = normalizeText(provider.state);
    const country = normalizeText(provider.country);
    const pincode = normalizeText(provider.pincode);

    if (![district, state, country, pincode].some(Boolean)) return;

    const key = [district, state, country, pincode]
      .map((value) => value.toUpperCase())
      .join('||');

    if (!records.has(key)) {
      records.set(key, { district, state, country, pincode });
    }
  });

  return Array.from(records.values());
}

export function buildLogisticsFilterOptions(
  combinations: LogisticsLocationCombination[],
) {
  return {
    districts: uniqueSorted(combinations.map((item) => item.district || '')),
    states: uniqueSorted(combinations.map((item) => item.state || '')),
    countries: uniqueSorted(combinations.map((item) => item.country || '')),
    pincodes: uniqueSorted(combinations.map((item) => item.pincode || ''))
  };
}

export function filterLogisticsProviders<T extends LogisticsProviderFilterable>(
  providers: T[],
  filters: LogisticsFilterState
) {
  const searchQuery = normalizeLower(filters.search);

  return providers.filter((provider) => {
    if (
      searchQuery &&
      !normalizeLower(provider.company_name).includes(searchQuery) &&
      !normalizeLower(provider.address).includes(searchQuery) &&
      !normalizeLower(provider.district).includes(searchQuery) &&
      !normalizeLower(provider.state).includes(searchQuery) &&
      !normalizeLower(provider.country).includes(searchQuery) &&
      !normalizeLower(provider.pincode).includes(searchQuery)
    ) {
      return false;
    }

    if (filters.district && !sameValue(provider.district, filters.district)) return false;
    if (filters.state && !sameValue(provider.state, filters.state)) return false;
    if (filters.country && !sameValue(provider.country, filters.country)) return false;
    if (filters.pincode && !sameValue(provider.pincode, filters.pincode)) return false;

    return true;
  });
}
