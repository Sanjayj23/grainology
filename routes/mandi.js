import express from 'express';
import axios from 'axios';
import MandiPrice from '../models/MandiPrice.js';
import User from '../models/User.js';
import { authenticate, isAdminRole } from '../middleware/auth.js';
import { fetchCedaAgmarknet } from '../utils/cedaAgmarknet.js';

const router = express.Router();

// CEDA API (first priority) - https://api.ceda.ashoka.edu.in/
const CEDA_API_KEY = process.env.CEDA_API_KEY || '';

// Environment for data.gov.in Mandi API (fallback)
const MANDI_API_BASE = (process.env.MANDI_API_BASE || 'https://api.data.gov.in').replace(/\/$/, '');
const MANDI_API_KEY = process.env.MANDI_API_KEY || '';
// Default to variety-wise daily market prices resource if env not provided
const MANDI_RESOURCE_ID = process.env.MANDI_RESOURCE_ID || '35985678-0d79-46b4-9ed6-6f13308a1d24';

// Default state and commodities for mandi data (Bihar, Maize, Wheat, Paddy)
const DEFAULT_STATE = 'Bihar';
const DEFAULT_COMMODITIES = ['Paddy', 'Maize', 'Wheat'];

// MSP (Minimum Support Price) data for 2025-26 season
const MSP_DATA = {
  'Bajra': 2775.00,
  'Pearl Millet': 2775.00,
  'Cumbu': 2775.00,
  'Barley': 1980.00,
  'Jau': 1980.00,
  'Jowar': 3699.00,
  'Sorghum': 3699.00,
  'Maize': 2400.00,
  'Paddy': 2369.00,
  'Common Paddy': 2369.00,
  'Ragi': 4886.00,
  'Finger Millet': 4886.00,
  'Wheat': 2425.00,
  'Cotton': 7710.00,
  'Copra': 12100.00,
  'Groundnut': 7263.00,
  'Soybean': 4600.00,
  'Sunflower': 7200.00,
  'Tomato': 0, // No MSP for vegetables
  'Onion': 0,
  'Potato': 0,
};

// Commodity groups mapping
const COMMODITY_GROUPS = {
  'Cereals': ['Bajra', 'Pearl Millet', 'Cumbu', 'Barley', 'Jau', 'Jowar', 'Sorghum', 'Maize', 'Paddy', 'Common Paddy', 'Ragi', 'Finger Millet', 'Wheat'],
  'Fibre Crops': ['Cotton'],
  'Oil Seeds': ['Copra', 'Groundnut', 'Soybean', 'Sunflower'],
  'Vegetables': ['Tomato', 'Onion', 'Potato'],
  'Others': []
};

// Helper to get commodity group
const getCommodityGroup = (commodity) => {
  if (!commodity) return 'Others';
  const commodityUpper = commodity.trim();
  for (const [group, commodities] of Object.entries(COMMODITY_GROUPS)) {
    if (commodities.some(c => commodityUpper.includes(c) || c.includes(commodityUpper))) {
      return group;
    }
  }
  return 'Others';
};

// Helper to get MSP for a commodity
const getMSP = (commodity) => {
  if (!commodity) return 0;
  const commodityUpper = commodity.trim();
  for (const [key, value] of Object.entries(MSP_DATA)) {
    if (commodityUpper.includes(key) || key.includes(commodityUpper)) {
      return value;
    }
  }
  return 0;
};

// Helper to extract arrival quantity
const extractArrival = (record) => {
  const possibleKeys = [
    'Arrival', 'arrival', 'Arrival_Qty', 'arrival_qty',
    'Arrival_Metric_Tonnes', 'arrival_metric_tonnes',
    'Arrival_MT', 'arrival_mt', 'Quantity', 'quantity'
  ];
  
  for (const key of possibleKeys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      const cleaned = String(value).replace(/,/g, '').trim();
      const num = Number(cleaned);
      if (!isNaN(num) && num >= 0) {
        return num;
      }
    }
  }
  return 0;
};

// AgMarkNet-style endpoint: Grouped data by commodity with date columns
// 1st priority: CEDA API (Bihar, Maize, Wheat, Paddy as default). Fallback: data.gov.in
router.get('/agmarknet', async (req, res) => {
  try {
    const {
      state: qState = 'all',
      district = 'all',
      market = 'all',
      commodity_group = 'all',
      commodity = 'all',
      variety = 'all',
      grade = 'FAQ',
      limit = 1000,
      offset = 0,
    } = req.query;

    // Default to Bihar and Cereals (Paddy, Maize, Wheat) when not specified
    const state = (qState && qState !== 'all') ? qState : DEFAULT_STATE;
    const queryForCeda = {
      state: qState && qState !== 'all' ? qState : DEFAULT_STATE,
      district,
      market,
      commodity_group: commodity_group || 'Cereals',
      commodity,
      variety,
      grade,
    };

    // 1st priority: try CEDA API
    if (CEDA_API_KEY) {
      try {
        const cedaResult = await fetchCedaAgmarknet(queryForCeda);
        if (cedaResult && cedaResult.success && cedaResult.data && cedaResult.data.length > 0) {
          return res.json(cedaResult);
        }
      } catch (cedaErr) {
        console.warn('CEDA Agmarknet failed, using fallback:', cedaErr.message);
      }
    }

    // Fallback: existing data.gov.in API
    if (!MANDI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'MANDI_API_KEY is not configured on the server. CEDA API did not return data.'
      });
    }

    const params = new URLSearchParams({
      'api-key': MANDI_API_KEY,
      format: 'json',
      limit: Math.min(Number(limit) || 1000, 5000).toString(),
      offset: (Number(offset) || 0).toString(),
    });

    // Apply filters - state already defaulted to Bihar when 'all'
    if (state) params.append('filters[state.keyword]', state);
    if (district && district !== 'all') params.append('filters[district]', district);
    if (market && market !== 'all') params.append('filters[market]', market);
    if (commodity && commodity !== 'all') params.append('filters[commodity]', commodity);
    if (variety && variety !== 'all') params.append('filters[variety]', variety);
    
    // If commodity_group is 'Cereals' and commodity is 'all', fetch Paddy, Maize, Wheat by default
    if (commodity_group === 'Cereals' && commodity === 'all') {
      // Increase limit to get more data for multiple commodities
      params.set('limit', Math.min(Number(limit) || 5000, 10000).toString());
    }

    const url = `${MANDI_API_BASE}/resource/${MANDI_RESOURCE_ID}?${params.toString()}`;
    const response = await axios.get(url, { timeout: 15000 });

    const records = response.data?.records || [];

    // Helper to extract price
    const extractPrice = (record) => {
      const possibleKeys = [
        'Modal_Price', 'modal_price', 'ModalPrice', 'modalprice',
        'modal_price_rs_quintal', 'modal_price_rs_per_quintal',
        'Price', 'price', 'Avg_Price', 'avg_price'
      ];
      
      for (const key of possibleKeys) {
        const value = record[key];
        if (value !== undefined && value !== null && value !== '') {
          const cleaned = String(value).replace(/,/g, '').trim();
          const num = Number(cleaned);
          if (!isNaN(num) && num > 0) {
            return num;
          }
        }
      }
      return 0;
    };

    // Group data by commodity and date
    const grouped = {};
    
    records.forEach(record => {
      const commodityName = record.Commodity || record.commodity || record.commodity_name || '';
      const varietyName = record.Variety || record.variety || record.variety_name || '';
      const dateStr = record.Arrival_Date || record.arrival_date || record.date || '';
      
      if (!commodityName) return;
      
      // Create a unique key for commodity + variety combination
      const key = varietyName ? `${commodityName} - ${varietyName}` : commodityName;
      
      if (!grouped[key]) {
        grouped[key] = {
          commodity_group: getCommodityGroup(commodityName),
          commodity: commodityName,
          variety: varietyName || '',
          msp: getMSP(commodityName),
          dates: {}
        };
      }
      
      if (dateStr) {
        const dateKey = dateStr.split('T')[0]; // Get YYYY-MM-DD format
        if (!grouped[key].dates[dateKey]) {
          grouped[key].dates[dateKey] = {
            price: extractPrice(record),
            arrival: extractArrival(record)
          };
        } else {
          // If multiple records for same date, average the price and sum arrivals
          const existing = grouped[key].dates[dateKey];
          const newPrice = extractPrice(record);
          const newArrival = extractArrival(record);
          
          if (newPrice > 0) {
            existing.price = existing.price > 0 
              ? (existing.price + newPrice) / 2 
              : newPrice;
          }
          existing.arrival += newArrival;
        }
      }
    });

    // Convert to array and filter by commodity group if specified
    let result = Object.values(grouped);
    
    if (commodity_group && commodity_group !== 'all') {
      result = result.filter(item => item.commodity_group === commodity_group);
    }

    // Sort by commodity group and commodity name
    result.sort((a, b) => {
      if (a.commodity_group !== b.commodity_group) {
        return a.commodity_group.localeCompare(b.commodity_group);
      }
      return a.commodity.localeCompare(b.commodity);
    });

    // Get unique dates from all records (last 3 days)
    const allDates = new Set();
    result.forEach(item => {
      Object.keys(item.dates).forEach(date => allDates.add(date));
    });
    const sortedDates = Array.from(allDates).sort().reverse().slice(0, 3);

    return res.json({
      success: true,
      data: result,
      dates: sortedDates,
      filters: { state, district, market, commodity_group, commodity, variety, grade },
      count: result.length
    });
  } catch (error) {
    console.error('AgMarkNet API error:', error);
    return res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch AgMarkNet-style data',
      details: error.response?.data || error.message,
    });
  }
});

// Public: live mandi prices from data.gov.in (no auth required)
router.get('/live', async (req, res) => {
  try {
    if (!MANDI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'MANDI_API_KEY is not configured on the server'
      });
    }

    const {
      state,
      district,
      market,
      commodity,
      limit = 50,
      offset = 0,
      format = 'json',
    } = req.query;

    const params = new URLSearchParams({
      'api-key': MANDI_API_KEY,
      format: format || 'json',
      limit: Math.min(Number(limit) || 50, 100).toString(),
      offset: (Number(offset) || 0).toString(),
    });

    // Apply filters per data.gov.in spec
    if (state) params.append('filters[state.keyword]', state);
    if (district) params.append('filters[district]', district);
    if (market) params.append('filters[market]', market);
    if (commodity) params.append('filters[commodity]', commodity);

    const url = `${MANDI_API_BASE}/resource/${MANDI_RESOURCE_ID}?${params.toString()}`;
    const response = await axios.get(url, { timeout: 10000 });

    const records = response.data?.records || [];

    // Log first record structure and all available keys for debugging
    if (records.length > 0) {
      const sampleRecord = records[0];
      console.log('Sample record keys from data.gov.in:', Object.keys(sampleRecord));
      console.log('Sample record (first 3 fields):', {
        ...Object.fromEntries(Object.entries(sampleRecord).slice(0, 3)),
        '...': '...'
      });
      // Log price-related fields specifically
      const priceFields = Object.keys(sampleRecord).filter(k => 
        k.toLowerCase().includes('price') || k.toLowerCase().includes('min') || 
        k.toLowerCase().includes('max') || k.toLowerCase().includes('modal')
      );
      if (priceFields.length > 0) {
        console.log('Price-related fields found:', priceFields.map(k => `${k}: ${sampleRecord[k]}`));
      } else {
        console.warn('⚠️  No price-related fields found in record!');
      }
    }

    // Helper function to extract price value from various field name formats
    const extractPrice = (record, possibleKeys, fieldType = '') => {
      // First try the known possible keys
      for (const key of possibleKeys) {
        const value = record[key];
        if (value !== undefined && value !== null && value !== '') {
          // Handle string values with commas (e.g., "1,234.56")
          const cleaned = String(value).replace(/,/g, '').trim();
          const num = Number(cleaned);
          if (!isNaN(num) && num > 0) {
            return num;
          }
        }
      }
      
      // Fallback: search for any field containing the price type (case-insensitive)
      if (fieldType) {
        const allKeys = Object.keys(record);
        const matchingKey = allKeys.find(k => 
          k.toLowerCase().includes(fieldType.toLowerCase()) && 
          (k.toLowerCase().includes('price') || k.toLowerCase().includes('rs'))
        );
        if (matchingKey) {
          const value = record[matchingKey];
          if (value !== undefined && value !== null && value !== '') {
            const cleaned = String(value).replace(/,/g, '').trim();
            const num = Number(cleaned);
            if (!isNaN(num) && num > 0) {
              console.log(`Found ${fieldType} price in field: ${matchingKey} = ${num}`);
              return num;
            }
          }
        }
      }
      
      return 0;
    };

    // Normalize records to front-end shape
    const mapped = records.map((r, idx) => {
      // Try multiple possible field name variations for prices (including capitalized versions)
      const minPrice = extractPrice(r, [
        'Min_Price', // Capitalized version from data.gov.in
        'min_price',
        'minprice',
        'MinPrice',
        'min_price_rs_quintal',
        'min_price_rs_quintal_',
        'min_price_rs_per_quintal',
        'min_price_rs_per_quintal_',
        'min_price_rs_quintal__',
        'min_price_rs_per_quintal__'
      ], 'min');

      const maxPrice = extractPrice(r, [
        'Max_Price', // Capitalized version from data.gov.in
        'max_price',
        'maxprice',
        'MaxPrice',
        'max_price_rs_quintal',
        'max_price_rs_quintal_',
        'max_price_rs_per_quintal',
        'max_price_rs_per_quintal_',
        'max_price_rs_quintal__',
        'max_price_rs_per_quintal__'
      ], 'max');

      const modalPrice = extractPrice(r, [
        'Modal_Price', // Capitalized version from data.gov.in
        'modal_price',
        'modalprice',
        'ModalPrice',
        'modal_price_rs_quintal',
        'modal_price_rs_quintal_',
        'modal_price_rs_per_quintal',
        'modal_price_rs_per_quintal_',
        'modal_price_rs_quintal__',
        'modal_price_rs_per_quintal__'
      ], 'modal');

      return {
        id: r._id || r.id || `${r.Market || r.market || r.market_name || 'mandi'}-${idx}`,
        state: r.State || r.state || r.state_name || '',
        district: r.District || r.district || r.district_name || '',
        market: r.Market || r.market || r.market_name || '',
        commodity: r.Commodity || r.commodity || r.commodity_name || '',
        variety: r.Variety || r.variety || r.variety_name || '',
        min_price: minPrice,
        max_price: maxPrice,
        modal_price: modalPrice,
        price_date: r.Arrival_Date || r.arrival_date || r.date || r.price_date || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
    });

    // Log statistics about mapped data
    const recordsWithPrices = mapped.filter(r => r.min_price > 0 || r.max_price > 0 || r.modal_price > 0);
    console.log(`Mandi API: Fetched ${records.length} records, ${recordsWithPrices.length} have valid prices`);

    return res.json({
      success: true,
      count: mapped.length,
      total: response.data?.total || mapped.length,
      limit: Number(limit) || 50,
      offset: Number(offset) || 0,
      records: mapped,
      raw: process.env.NODE_ENV === 'development' ? records : undefined,
    });
  } catch (error) {
    console.error('Live mandi API error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    return res.status(error.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch live mandi prices',
      details: error.response?.data || error.message,
    });
  }
});

// Complete list of all Indian States and Union Territories
const ALL_INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry'
];

// Get filter options (states, districts, markets, commodities, varieties)
router.get('/filters', async (req, res) => {
  try {
    if (!MANDI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'MANDI_API_KEY is not configured on the server'
      });
    }

    // Fetch a large sample to get all unique values
    const params = new URLSearchParams({
      'api-key': MANDI_API_KEY,
      format: 'json',
      limit: '5000',
      offset: '0',
    });

    const url = `${MANDI_API_BASE}/resource/${MANDI_RESOURCE_ID}?${params.toString()}`;
    let records = [];
    
    try {
      const response = await axios.get(url, { timeout: 15000 });
      records = response.data?.records || [];
    } catch (error) {
      console.warn('Failed to fetch filter data from API, using default states:', error.message);
    }

    const states = new Set();
    const districts = new Set();
    const markets = new Set();
    const commodities = new Set();
    const varieties = new Set();
    const commodityGroups = new Set();

    // Add all Indian states first (ensures all states are included)
    ALL_INDIAN_STATES.forEach(state => states.add(state));

    // Then add states from API records (may have variations or additional data)
    records.forEach(record => {
      const state = record.State || record.state || record.state_name;
      const district = record.District || record.district || record.district_name;
      const market = record.Market || record.market || record.market_name;
      const commodity = record.Commodity || record.commodity || record.commodity_name;
      const variety = record.Variety || record.variety || record.variety_name;

      if (state) states.add(state);
      if (district) districts.add(district);
      if (market) markets.add(market);
      if (commodity) {
        commodities.add(commodity);
        commodityGroups.add(getCommodityGroup(commodity));
      }
      if (variety) varieties.add(variety);
    });

    // Sort states: Bihar first (default), then rest by list order / alphabetically
    const sortedStates = Array.from(states).sort((a, b) => {
      if (a === 'Bihar') return -1;
      if (b === 'Bihar') return 1;
      const aIndex = ALL_INDIAN_STATES.indexOf(a);
      const bIndex = ALL_INDIAN_STATES.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

    return res.json({
      success: true,
      states: sortedStates,
      districts: Array.from(districts).sort(),
      markets: Array.from(markets).sort(),
      commodities: Array.from(commodities).sort(),
      varieties: Array.from(varieties).sort(),
      commodity_groups: Array.from(commodityGroups).sort(),
    });
  } catch (error) {
    console.error('Get filters error:', error);
    // Return default states even on error
    return res.json({
      success: true,
      states: ALL_INDIAN_STATES,
      districts: [],
      markets: [],
      commodities: ['Paddy', 'Maize', 'Wheat', 'Bajra', 'Barley', 'Jowar', 'Ragi', 'Cotton', 'Copra', 'Groundnut'],
      varieties: [],
      commodity_groups: ['Cereals', 'Fibre Crops', 'Oil Seeds'],
    });
  }
});

// Get all mandi prices
router.get('/', authenticate, async (req, res) => {
  try {
    const { state, district, commodity, variety } = req.query;
    const query = {};

    if (state) query.state = state;
    if (district) query.district = district;
    if (commodity) query.commodity = commodity;
    if (variety) query.variety = variety;

    const prices = await MandiPrice.find(query).sort({ price_date: -1, createdAt: -1 });
    res.json(prices);
  } catch (error) {
    console.error('Get mandi prices error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch mandi prices' });
  }
});

// Get mandi price by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const price = await MandiPrice.findById(req.params.id);
    if (!price) {
      return res.status(404).json({ error: 'Mandi price not found' });
    }
    res.json(price);
  } catch (error) {
    console.error('Get mandi price error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch mandi price' });
  }
});

// Create mandi price (admin only)
router.post('/', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!isAdminRole(user)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const price = new MandiPrice(req.body);
    await price.save();
    res.status(201).json(price);
  } catch (error) {
    console.error('Create mandi price error:', error);
    res.status(500).json({ error: error.message || 'Failed to create mandi price' });
  }
});

export default router;
