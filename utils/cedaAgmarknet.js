/**
 * CEDA Data Portal API (Agmarknet) - https://api.ceda.ashoka.edu.in/
 * First-priority source for mandi data. Fallback to data.gov.in if unavailable.
 */
import axios from 'axios';

const CEDA_BASE = (process.env.CEDA_API_BASE || 'https://api.ceda.ashoka.edu.in/v1').replace(/\/$/, '');
const CEDA_API_KEY = process.env.CEDA_API_KEY || '';

const COMMODITY_GROUPS = {
  'Cereals': ['Bajra', 'Pearl Millet', 'Cumbu', 'Barley', 'Jau', 'Jowar', 'Sorghum', 'Maize', 'Paddy', 'Common Paddy', 'Ragi', 'Finger Millet', 'Wheat'],
  'Fibre Crops': ['Cotton'],
  'Oil Seeds': ['Copra', 'Groundnut', 'Soybean', 'Sunflower'],
  'Vegetables': ['Tomato', 'Onion', 'Potato'],
  'Others': []
};

const MSP_DATA = {
  'Maize': 2400, 'Paddy': 2369, 'Common Paddy': 2369, 'Wheat': 2425,
  'Bajra': 2775, 'Barley': 1980, 'Jowar': 3699, 'Ragi': 4886,
  'Cotton': 7710, 'Copra': 12100, 'Groundnut': 7263, 'Soybean': 4600,
};

function getCommodityGroup(commodity) {
  if (!commodity) return 'Others';
  const c = String(commodity).trim();
  for (const [group, list] of Object.entries(COMMODITY_GROUPS)) {
    if (list.some(x => c.includes(x) || x.includes(c))) return group;
  }
  return 'Others';
}

function getMSP(commodity) {
  if (!commodity) return 0;
  const c = String(commodity).trim();
  for (const [key, value] of Object.entries(MSP_DATA)) {
    if (c.includes(key) || key.includes(c)) return value;
  }
  return 0;
}

function cedaRequest(method, path, data = null) {
  const url = `${CEDA_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(CEDA_API_KEY && { 'Authorization': `Bearer ${CEDA_API_KEY}` }),
    ...(CEDA_API_KEY && { 'x-api-key': CEDA_API_KEY }),
  };
  const config = { method, url, headers, timeout: 15000 };
  if (data && (method === 'POST' || method === 'PUT')) config.data = data;
  return axios(config);
}

/**
 * Fetch commodities list from CEDA (GET /agmarknet/commodities)
 */
async function getCedaCommodities() {
  const res = await cedaRequest('GET', '/agmarknet/commodities');
  const raw = res.data;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  if (raw && Array.isArray(raw.commodities)) return raw.commodities;
  if (raw && typeof raw === 'object') return Object.entries(raw).map(([id, name]) => ({ id, name: name || id }));
  return [];
}

/**
 * Fetch geographies (states/districts) from CEDA (GET /agmarknet/geographies)
 */
async function getCedaGeographies() {
  const res = await cedaRequest('GET', '/agmarknet/geographies');
  const raw = res.data;
  return raw || {};
}

/**
 * Fetch prices from CEDA (POST /agmarknet/prices).
 * Body may be e.g. { commodity_id, state_id } or { commodity, state, level } - adapt to API spec.
 */
async function getCedaPrices(body) {
  const res = await cedaRequest('POST', '/agmarknet/prices', body);
  return res.data;
}

/**
 * Find commodity id/name in CEDA list (case-insensitive match for Paddy, Maize, Wheat)
 */
function findCommodityId(commoditiesList, name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  const list = Array.isArray(commoditiesList) ? commoditiesList : Object.entries(commoditiesList || {}).map(([id, label]) => ({ id, name: label }));
  for (const c of list) {
    const id = c.id ?? c.commodity_id ?? c.key;
    const label = (c.name ?? c.commodity ?? c.label ?? (typeof c === 'string' ? c : '')).trim().toLowerCase();
    if (label === n || label.includes(n) || n.includes(label)) return (id != null ? id : label) || c;
  }
  return null;
}

/**
 * Find state id/name in geographies (Bihar)
 */
function findStateId(geographies, stateName) {
  const n = String(stateName || '').trim().toLowerCase();
  if (!n) return null;
  const states = geographies.states ?? geographies.state ?? geographies.regions ?? [];
  const arr = Array.isArray(states) ? states : Object.entries(states).map(([id, name]) => ({ id, name }));
  for (const s of arr) {
    const id = s.id ?? s.state_id ?? s.key;
    const label = (s.name ?? s.state ?? s.label ?? '').trim().toLowerCase();
    if (label === n || label.includes(n) || n.includes(label)) return (id != null ? id : label) || s;
  }
  return null;
}

/**
 * Normalize CEDA price response to our agmarknet shape: { data, dates }
 */
function normalizeCedaToAgmarknet(cedaPrices, commodityName, varietyName = '') {
  const key = varietyName ? `${commodityName} - ${varietyName}` : commodityName;
  const item = {
    commodity_group: getCommodityGroup(commodityName),
    commodity: commodityName,
    variety: varietyName || '',
    msp: getMSP(commodityName),
    dates: {}
  };
  const records = Array.isArray(cedaPrices) ? cedaPrices : (cedaPrices?.data ?? cedaPrices?.prices ?? cedaPrices?.records ?? []);
  const dateKeys = new Set();

  for (const r of records) {
    const dateStr = r.date ?? r.arrival_date ?? r.price_date ?? r.report_date ?? r.Arrival_Date ?? '';
    if (!dateStr) continue;
    const dateKey = String(dateStr).split('T')[0];
    const price = Number(r.price ?? r.modal_price ?? r.avg_price ?? r.min_price ?? r.max_price ?? r.Modal_Price ?? 0) || 0;
    const arrival = Number(r.arrival ?? r.quantity ?? r.arrival_qty ?? r.Arrival ?? 0) || 0;
    if (!item.dates[dateKey]) item.dates[dateKey] = { price: 0, arrival: 0 };
    if (price > 0) item.dates[dateKey].price = item.dates[dateKey].price ? (item.dates[dateKey].price + price) / 2 : price;
    item.dates[dateKey].arrival += arrival;
    dateKeys.add(dateKey);
  }

  const dates = Array.from(dateKeys).sort().reverse().slice(0, 5);
  return { data: [item], dates };
}

/**
 * Fetch mandi data from CEDA API. Returns { success, data, dates } or null on failure.
 * Default: Bihar, Maize, Wheat, Paddy.
 */
export async function fetchCedaAgmarknet(query = {}) {
  if (!CEDA_API_KEY) return null;

  const state = (query.state && query.state !== 'all') ? query.state : 'Bihar';
  const district = (query.district && query.district !== 'all') ? query.district : null;
  const commodityFilter = (query.commodity && query.commodity !== 'all') ? query.commodity : null;
  const defaultCommodities = ['Paddy', 'Maize', 'Wheat'];
  const commoditiesToFetch = commodityFilter ? [commodityFilter] : defaultCommodities;

  try {
    const [commoditiesList, geographies] = await Promise.all([
      getCedaCommodities(),
      getCedaGeographies()
    ]);

    const stateId = findStateId(geographies, state);
    const allData = [];
    const allDatesSet = new Set();

    for (const commName of commoditiesToFetch) {
      const commodityId = findCommodityId(commoditiesList, commName);
      const requestBody = {
        ...(commodityId && (typeof commodityId === 'object' ? commodityId : { commodity_id: commodityId })),
        ...(stateId && (typeof stateId === 'object' ? stateId : { state_id: stateId })),
        ...(district && { district_id: district }),
        commodity: commName,
        state: state,
        level: district ? 'district' : 'state'
      };
      Object.keys(requestBody).forEach(k => requestBody[k] === undefined && delete requestBody[k]);

      try {
        const pricesResponse = await getCedaPrices(requestBody);
        const normalized = normalizeCedaToAgmarknet(pricesResponse, commName, '');
        if (normalized.data && normalized.data.length > 0) {
          allData.push(...normalized.data);
          (normalized.dates || []).forEach(d => allDatesSet.add(d));
        }
      } catch (err) {
        console.warn('CEDA prices for', commName, err.message);
      }
    }

    if (allData.length === 0) return null;

    const dates = Array.from(allDatesSet).sort().reverse().slice(0, 5);
    return {
      success: true,
      data: allData,
      dates,
      filters: { state, district, market: query.market || 'all', commodity_group: query.commodity_group || 'all', commodity: query.commodity || 'all', variety: query.variety || 'all', grade: query.grade || 'FAQ' },
      count: allData.length,
      source: 'ceda'
    };
  } catch (err) {
    console.warn('CEDA Agmarknet fetch error:', err.message);
    return null;
  }
}

export { CEDA_API_KEY, CEDA_BASE };
