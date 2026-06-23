import { getSupabaseAdmin } from '../config/supabase.js';

// ---- API Service ----
const BASE_URL = process.env.AGMARKNET_BASE_URL || 'https://api.agmarknet.gov.in/v1';
const COMMON_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "origin": "https://agmarknet.gov.in",
  "referer": "https://agmarknet.gov.in/",
  "user-agent": "Mozilla/5.0"
};

async function fetchWithRetry(url, options, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) return response;
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Client error: ${response.status} ${response.statusText}`);
      }
      if (i === retries) throw new Error(`Server error: ${response.status} ${response.statusText}`);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        if (i === retries) throw new Error(`Timeout fetching ${url}`);
      } else {
        if (i === retries || (err.message && err.message.startsWith('Client error'))) throw err;
      }
    }
    await new Promise(res => setTimeout(res, 1000));
  }
  throw new Error("Unreachable");
}

export async function fetchDashboardFilters(dashboardName = 'marketwise_price_arrival') {
  const url = `${BASE_URL}/dashboard-filters/?dashboard_name=${dashboardName}`;
  const response = await fetchWithRetry(url, { headers: COMMON_HEADERS });
  const json = await response.json();
  return json.data;
}

export async function fetchDashboardData(payload) {
  const url = `${BASE_URL}/dashboard-data/`;
  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: { ...COMMON_HEADERS, "content-type": "application/json" },
    body: JSON.stringify({ ...payload, format: 'json' })
  });
  return await response.json();
}

// ---- Cache Service ----
export async function getFiltersCache(dashboardName = 'marketwise_price_arrival') {
  const { data, error } = await getSupabaseAdmin()
    .from('agmarknet_filters_cache')
    .select('*')
    .eq('dashboard_name', dashboardName)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function saveFiltersCache(dashboardName, filtersData, ttlHours = 24) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);
  const { data: existing } = await getSupabaseAdmin()
    .from('agmarknet_filters_cache')
    .select('id')
    .eq('dashboard_name', dashboardName)
    .limit(1)
    .maybeSingle();

  if (existing) {
    await getSupabaseAdmin().from('agmarknet_filters_cache').update({
      data: filtersData,
      fetched_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    }).eq('id', existing.id);
  } else {
    await getSupabaseAdmin().from('agmarknet_filters_cache').insert({
      dashboard_name: dashboardName,
      data: filtersData,
      expires_at: expiresAt.toISOString()
    });
  }
}

export async function getMarketwiseCache(cacheKey) {
  const { data, error } = await getSupabaseAdmin()
    .from('agmarknet_marketwise_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function saveMarketwiseCache(cacheKey, payload, columns, records, reportedDates, ttlHours = 24) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + ttlHours);

  const { data: existing } = await getSupabaseAdmin()
    .from('agmarknet_marketwise_cache')
    .select('id')
    .eq('cache_key', cacheKey)
    .limit(1)
    .maybeSingle();

  const row = {
    cache_key: cacheKey,
    request_payload: payload,
    response_columns: columns,
    records: records,
    reported_dates: reportedDates,
    fetched_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
    source_status: 'success'
  };

  if (existing) {
    await getSupabaseAdmin().from('agmarknet_marketwise_cache').update(row).eq('id', existing.id);
  } else {
    await getSupabaseAdmin().from('agmarknet_marketwise_cache').insert(row);
  }
}

export function isExpired(expiresAtString) {
  return new Date(expiresAtString).getTime() < new Date().getTime();
}

// ---- CacheKey Util ----
export function buildCacheKey(payload) {
  const { dashboard, date, state, district, market, group, commodity, variety, grades } = payload;
  const dStr = district && district.length > 0 ? [...district].sort().join(',') : 'all';
  const mStr = market && market.length > 0 ? [...market].sort().join(',') : 'all';
  const cStr = commodity && commodity.length > 0 ? [...commodity].sort().join(',') : 'all';
  const gStr = group && group.length > 0 ? [...group].sort().join(',') : 'all';
  const gradeStr = grades && grades.length > 0 ? [...grades].sort().join(',') : 'all';
  return `${dashboard}|date=${date}|state=${state}|district=${dStr}|market=${mStr}|group=${gStr}|commodity=${cStr}|variety=${variety}|grades=${gradeStr}`;
}

// ---- Normalize Service ----
export function normalizeMarketwiseData(rawResponse) {
  if (!rawResponse.data || !rawResponse.data.records) return [];
  const columns = rawResponse.data.columns;
  if (!columns) return [];
  const priceGroup = columns.find((c) => c.key === 'price_group');
  const arrivalGroup = columns.find((c) => c.key === 'arrival_group');
  const pTitles = priceGroup?.columns.map((c) => c.title) || ['', '', ''];
  const aTitles = arrivalGroup?.columns.map((c) => c.title) || ['', '', ''];

  return rawResponse.data.records.map((r) => {
    return {
      commodity_group: r.cmdt_grp_name,
      commodity: r.cmdt_name,
      msp_price_rs_per_quintal: parseFloat(r.msp_price) || null,
      reported_date: r.reported_date,
      trend: r.trend,
      price: {
        as_on: { title: pTitles[0], value: parseFloat(r.as_on_price) || null },
        one_day_ago: { title: pTitles[1], value: parseFloat(r.one_day_ago_price) || null },
        two_day_ago: { title: pTitles[2], value: parseFloat(r.two_day_ago_price) || null }
      },
      arrival_metric_tonnes: {
        as_on: { title: aTitles[0], value: parseFloat(r.as_on_arrival) || null },
        one_day_ago: { title: aTitles[1], value: parseFloat(r.one_day_ago_arrival) || null },
        two_day_ago: { title: aTitles[2], value: parseFloat(r.two_day_ago_arrival) || null }
      },
      msp_source: r.msp_source || 'agmarknet',
      raw: r
    };
  });
}

// ---- MSP Fallback ----
export async function getFallbackMspByCommodityName(commodityName) {
  const { data, error } = await getSupabaseAdmin()
    .from('msp_fallback_prices')
    .select('msp_price')
    .ilike('commodity_name', `%${commodityName}%`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return Number(data.msp_price);
}

export async function applyFallbackMsp(records) {
  for (const record of records) {
    let msp = parseFloat(record.msp_price);
    if (isNaN(msp) || msp === 0) {
      const fallback = await getFallbackMspByCommodityName(record.cmdt_name);
      if (fallback !== null) {
        record.msp_price = fallback.toString();
        record.msp_source = 'fallback';
      } else {
        record.msp_source = 'agmarknet';
      }
    } else {
      record.msp_source = 'agmarknet';
    }
  }
}

export async function refreshMarketwiseData(cacheKey, payload) {
  const apiData = await fetchDashboardData(payload);
  if (apiData.data && apiData.data.records) {
    await applyFallbackMsp(apiData.data.records);
  }
  const normalized = normalizeMarketwiseData(apiData);
  const reportedDates = [...new Set(normalized.map(r => r.reported_date))].filter(Boolean);
  const TTL_HOURS = Number(process.env.CACHE_TTL_HOURS || 24);
  await saveMarketwiseCache(cacheKey, payload, apiData.data?.columns, normalized, reportedDates, TTL_HOURS);
  return {
    columns: apiData.data?.columns,
    normalized,
    reportedDates
  };
}

export const getCachedStateIds = async () => {
  const { data, error } = await getSupabaseAdmin()
    .from('agmarknet_marketwise_cache')
    .select('request_payload, records');
  if (error) return [];
  return [...new Set((data || [])
    .filter((row) => Array.isArray(row.records) && row.records.length > 0)
    .map((row) => Number(row.request_payload?.state))
    .filter(Number.isFinite))]
    .sort((left, right) => left - right);
};

export const getAgmarknetFilters = async ({ forceRefresh = false } = {}) => {
  const dashboardName = process.env.AGMARKNET_DASHBOARD_NAME || 'marketwise_price_arrival';
  const TTL_HOURS = Number(process.env.CACHE_TTL_HOURS || 24);
  
  try {
    if (!forceRefresh) {
      const cache = await getFiltersCache(dashboardName);
      if (cache && !isExpired(cache.expires_at)) {
        return { source: 'cache', data: cache.data, stale: false, raw: cache.data };
      }
    }
    const apiData = await fetchDashboardFilters(dashboardName);
    await saveFiltersCache(dashboardName, apiData, TTL_HOURS);
    return { source: 'agmarknet-live', data: apiData, stale: false, raw: apiData };
  } catch (err) {
    console.error('Error fetching filters:', err);
    const cache = await getFiltersCache(dashboardName);
    if (cache) {
      return { source: 'agmarknet-direct-cache', data: cache.data, stale: true, raw: cache.data };
    }
    throw new Error('Failed to fetch filters and no cache available');
  }
};

export const getMarketwiseData = async (payload, { forceRefresh = false } = {}) => {
  // Always include dashboard in payload
  const finalPayload = { dashboard: 'marketwise_price_arrival', ...payload };
  const cacheKey = buildCacheKey(finalPayload);
  const TTL_HOURS = Number(process.env.CACHE_TTL_HOURS || 24);

  try {
    const cache = await getMarketwiseCache(cacheKey);

    if (!forceRefresh && cache) {
      const expired = isExpired(cache.expires_at);
      if (!expired) {
        return {
          status: 'success',
          stale: false,
          source: 'cache',
          cached: true,
          columns: cache.response_columns,
          records: cache.records,
          reportedDates: cache.reported_dates
        };
      }
      // Return stale cache immediately, refresh in background
      refreshMarketwiseData(cacheKey, finalPayload).catch(e => console.error('Background refresh failed:', e));
      return {
        status: 'success',
        stale: true,
        source: 'agmarknet-direct-cache',
        cached: true,
        columns: cache.response_columns,
        records: cache.records,
        reportedDates: cache.reported_dates
      };
    }

    // No cache or force refresh, fetch immediately
    const data = await refreshMarketwiseData(cacheKey, finalPayload);
    return {
      status: 'success',
      stale: false,
      source: 'agmarknet-live',
      cached: false,
      columns: data.columns,
      records: data.normalized,
      reportedDates: data.reportedDates
    };
  } catch (err) {
    console.error('Error fetching marketwise data:', err);
    throw new Error('Direct Agmarknet is temporarily unavailable and this filter combination has not been cached yet. Please try again later or choose a previously loaded filter.');
  }
};
