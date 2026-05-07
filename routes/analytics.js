import express from 'express';
import ConfirmedSalesOrder from '../models/ConfirmedSalesOrder.js';
import ConfirmedPurchaseOrder from '../models/ConfirmedPurchaseOrder.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// All analytics routes require authentication and admin role
router.use(authenticate);
router.use(requireAdmin);

// Helper: start/end of day in UTC so range matches MongoDB date comparison (transaction_date parses to UTC)
const startOfDay = (d) => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; };
const endOfDay = (d) => { const x = new Date(d); x.setUTCHours(23, 59, 59, 999); return x; };

const getDateRange = (period) => {
  const now = new Date();
  let startDate;
  let endDate = now;

  switch (period) {
    case 'today':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
    case 'week':
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
      break;
    case 'quarter':
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 3);
      break;
    case 'year':
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    case 'all':
    default:
      startDate = new Date('2020-01-01');
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      return { startDate, endDate };
  }

  startDate = startOfDay(startDate);
  endDate = endOfDay(endDate);
  return { startDate, endDate };
};

const normalizeOrderType = (value) => {
  const normalized = String(value || 'purchase').toLowerCase();
  return ['all', 'sales', 'purchase'].includes(normalized) ? normalized : 'all';
};

const normalizeFilterMode = (value) => {
  const normalized = String(value || 'year').toLowerCase();
  return ['year', 'month', 'week', 'date-range'].includes(normalized) ? normalized : 'year';
};

const parseValidYear = (value) => {
  const parsedYear = Number(value);
  return Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : null;
};

const parseValidMonth = (value) => {
  const parsedMonth = Number(value);
  return Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : null;
};

const parseValidWeek = (value) => {
  const parsedWeek = Number(value);
  return Number.isInteger(parsedWeek) && parsedWeek >= 1 && parsedWeek <= 53 ? parsedWeek : null;
};

const parseDateInput = (value) => {
  if (!value) return null;
  const parsedDate = new Date(`${String(value).trim()}T00:00:00.000Z`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const getISOWeekStart = (year, week) => {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = januaryFourth.getUTCDay() || 7;
  const weekOneStart = new Date(januaryFourth);
  weekOneStart.setUTCDate(januaryFourth.getUTCDate() - dayOfWeek + 1);
  const weekStart = new Date(weekOneStart);
  weekStart.setUTCDate(weekOneStart.getUTCDate() + (week - 1) * 7);
  return weekStart;
};

const shiftRangeToYear = (startDate, endDate, targetYear) => {
  const durationMs = endDate.getTime() - startDate.getTime();
  const shiftedStart = new Date(Date.UTC(
    targetYear,
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
    0, 0, 0, 0
  ));
  const shiftedEnd = new Date(shiftedStart.getTime() + durationMs);
  shiftedEnd.setUTCHours(23, 59, 59, 999);
  return {
    startDate: shiftedStart,
    endDate: shiftedEnd
  };
};

const getDateRangeForFilters = (filters = {}, overrideYear = null) => {
  const filterMode = normalizeFilterMode(filters.filterMode);
  const overrideParsedYear = parseValidYear(overrideYear);
  const parsedYear = parseValidYear(filters.year);
  const effectiveYear = overrideParsedYear || parsedYear;
  const parsedMonth = parseValidMonth(filters.month);
  const parsedWeek = parseValidWeek(filters.week);
  const parsedStartDate = parseDateInput(filters.startDate);
  const parsedEndDate = parseDateInput(filters.endDate);

  if (filterMode === 'date-range' && parsedStartDate && parsedEndDate) {
    if (overrideParsedYear) {
      return shiftRangeToYear(startOfDay(parsedStartDate), endOfDay(parsedEndDate), overrideParsedYear);
    }

    return {
      startDate: startOfDay(parsedStartDate),
      endDate: endOfDay(parsedEndDate)
    };
  }

  if (filterMode === 'month' && effectiveYear && parsedMonth) {
    return {
      startDate: new Date(Date.UTC(effectiveYear, parsedMonth - 1, 1, 0, 0, 0, 0)),
      endDate: new Date(Date.UTC(effectiveYear, parsedMonth, 0, 23, 59, 59, 999))
    };
  }

  if (filterMode === 'week' && effectiveYear && parsedWeek) {
    const weekStart = getISOWeekStart(effectiveYear, parsedWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    weekEnd.setUTCHours(23, 59, 59, 999);
    return {
      startDate: weekStart,
      endDate: weekEnd
    };
  }

  if (effectiveYear) {
    return {
      startDate: new Date(Date.UTC(effectiveYear, 0, 1, 0, 0, 0, 0)),
      endDate: new Date(Date.UTC(effectiveYear, 11, 31, 23, 59, 59, 999))
    };
  }

  return getDateRange(filters.period);
};

const getOrderTypeFlags = (orderType) => {
  const normalizedOrderType = normalizeOrderType(orderType);
  return {
    orderType: normalizedOrderType,
    includeSales: normalizedOrderType === 'all' || normalizedOrderType === 'sales',
    includePurchase: normalizedOrderType === 'all' || normalizedOrderType === 'purchase'
  };
};

const EMPTY_SUMMARY = {
  totalOrders: 0,
  totalAmount: 0,
  totalWeight: 0,
  totalDeductions: 0,
  avgRate: 0
};

const roundAmount = (value) => Math.round((Number(value) || 0) * 100) / 100;
const roundWeight = (value) => Math.round((Number(value) || 0) * 1000) / 1000;

const aggregateSummary = async (Model, startDate, endDate) => {
  const [summary] = await Model.aggregate([
    activeOrderMatchStage,
    effectiveDateStage,
    dateMatchStage(startDate, endDate),
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
        totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } },
        totalDeductions: { $sum: { $ifNull: ['$total_deduction', 0] } },
        avgRate: { $avg: { $ifNull: ['$rate_per_mt', 0] } }
      }
    }
  ]);

  if (!summary) return { ...EMPTY_SUMMARY };

  return {
    totalOrders: summary.totalOrders || 0,
    totalAmount: roundAmount(summary.totalAmount),
    totalWeight: roundWeight(summary.totalWeight),
    totalDeductions: roundAmount(summary.totalDeductions),
    avgRate: roundAmount(summary.avgRate)
  };
};

// Use booking date (transaction_date from excel) for analytics; fallback to createdAt
const effectiveDateStage = {
  $addFields: {
    _effectiveDate: {
      $ifNull: [
        { $dateFromString: { dateString: '$transaction_date', onError: null, onNull: null } },
        '$createdAt'
      ]
    }
  }
};
const dateMatchStage = (startDate, endDate) => ({ $match: { _effectiveDate: { $gte: startDate, $lte: endDate } } });
const activeOrderMatchStage = { $match: { trash: { $ne: true } } };

const paginateRows = (rows, page, limit) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.max(parseInt(limit, 10) || 50, 1);
  const total = rows.length;
  const startIndex = (pageNum - 1) * limitNum;

  return {
    rows: rows.slice(startIndex, startIndex + limitNum),
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
};

const nonEmptyStringExpr = (expr) => ({
  $let: {
    vars: {
      value: {
        $trim: {
          input: { $ifNull: [expr, ''] }
        }
      }
    },
    in: {
      $cond: [{ $eq: ['$$value', ''] }, null, '$$value']
    }
  }
});

const addCustomerNameStages = (type = 'sales') => [
  {
    $lookup: {
      from: 'users',
      localField: 'customer_id',
      foreignField: '_id',
      as: 'customer_info',
      pipeline: [
        { $project: { trade_name: 1, name: 1, email: 1 } }
      ]
    }
  },
  {
    $addFields: {
      _customerName: {
        $ifNull: [
          nonEmptyStringExpr({ $arrayElemAt: ['$customer_info.trade_name', 0] }),
          {
            $ifNull: [
              nonEmptyStringExpr(type === 'purchase' ? '$supplier_name' : '$seller_name'),
              {
                $ifNull: [
                  nonEmptyStringExpr({ $arrayElemAt: ['$customer_info.name', 0] }),
                  'Unknown'
                ]
              }
            ]
          }
        ]
      },
      _customerEmail: {
        $ifNull: [{ $arrayElemAt: ['$customer_info.email', 0] }, '' ]
      }
    }
  }
];

// Get time-based analytics (Daily/Weekly/Monthly trends)
router.get('/time-based', async (req, res) => {
  try {
    const { period = 'all', groupBy = 'month', orderType = 'purchase', year } = req.query;
    const { startDate, endDate } = getDateRangeForFilters(req.query);
    const { orderType: normalizedOrderType, includeSales, includePurchase } = getOrderTypeFlags(orderType);

    // Aggregation for sales orders (by booking date from sheet)
    const salesAggregation = includeSales
      ? await ConfirmedSalesOrder.aggregate([
          activeOrderMatchStage,
          effectiveDateStage,
          dateMatchStage(startDate, endDate),
          {
            $group: {
              _id: {
                $dateToString: {
                  format: groupBy === 'month' ? '%Y-%m' : groupBy === 'week' ? '%Y-W%V' : '%Y-%m-%d',
                  date: '$_effectiveDate'
                }
              },
              totalOrders: { $sum: 1 },
              totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
              totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } },
              avgRate: { $avg: { $ifNull: ['$rate_per_mt', 0] } }
            }
          },
          { $sort: { _id: 1 } }
        ])
      : [];

    // Aggregation for purchase orders (by booking date from sheet)
    const purchaseAggregation = includePurchase
      ? await ConfirmedPurchaseOrder.aggregate([
          activeOrderMatchStage,
          effectiveDateStage,
          dateMatchStage(startDate, endDate),
          {
            $group: {
              _id: {
                $dateToString: {
                  format: groupBy === 'month' ? '%Y-%m' : groupBy === 'week' ? '%Y-W%V' : '%Y-%m-%d',
                  date: '$_effectiveDate'
                }
              },
              totalOrders: { $sum: 1 },
              totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
              totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } },
              avgRate: { $avg: { $ifNull: ['$rate_per_mt', 0] } }
            }
          },
          { $sort: { _id: 1 } }
        ])
      : [];

    // Combine data for trends
    const allDates = new Set([
      ...salesAggregation.map(s => s._id),
      ...purchaseAggregation.map(p => p._id)
    ]);

    const trends = Array.from(allDates).sort().map(date => {
      const salesData = salesAggregation.find(s => s._id === date) || { totalOrders: 0, totalAmount: 0, totalWeight: 0 };
      const purchaseData = purchaseAggregation.find(p => p._id === date) || { totalOrders: 0, totalAmount: 0, totalWeight: 0 };
      
      return {
        date,
        salesOrders: salesData.totalOrders,
        salesAmount: Math.round(salesData.totalAmount * 100) / 100,
        salesWeight: Math.round(salesData.totalWeight * 1000) / 1000,
        purchaseOrders: purchaseData.totalOrders,
        purchaseAmount: Math.round(purchaseData.totalAmount * 100) / 100,
        purchaseWeight: Math.round(purchaseData.totalWeight * 1000) / 1000,
        totalOrders: salesData.totalOrders + purchaseData.totalOrders,
        totalAmount: Math.round((salesData.totalAmount + purchaseData.totalAmount) * 100) / 100
      };
    });

    // Monthly heatmap data (by booking date)
    const heatmapData = await ConfirmedSalesOrder.aggregate([
      activeOrderMatchStage,
      effectiveDateStage,
      dateMatchStage(startDate, endDate),
      {
        $group: {
          _id: {
            month: { $month: '$_effectiveDate' },
            dayOfWeek: { $dayOfWeek: '$_effectiveDate' }
          },
          count: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$net_amount', 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      trends,
      heatmapData,
      period,
      groupBy,
      year: year ? Number(year) : null,
      orderType: normalizedOrderType
    });
  } catch (error) {
    console.error('Time-based analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch time-based analytics' });
  }
});

// Get commodity analytics
router.get('/commodity', async (req, res) => {
  try {
    const { period = 'all', orderType = 'purchase', year } = req.query;
    const { startDate, endDate } = getDateRangeForFilters(req.query);
    const { orderType: normalizedOrderType, includeSales, includePurchase } = getOrderTypeFlags(orderType);

    // Commodity distribution for sales (by booking date)
    const salesByCommodity = includeSales
      ? await ConfirmedSalesOrder.aggregate([
          activeOrderMatchStage,
          effectiveDateStage,
          dateMatchStage(startDate, endDate),
          {
            $group: {
              _id: { $ifNull: [nonEmptyStringExpr('$commodity'), 'Unknown'] },
              totalOrders: { $sum: 1 },
              totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
              totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } },
              avgRate: { $avg: { $ifNull: ['$rate_per_mt', 0] } },
              minRate: { $min: { $ifNull: ['$rate_per_mt', 0] } },
              maxRate: { $max: { $ifNull: ['$rate_per_mt', 0] } }
            }
          },
          { $sort: { totalAmount: -1 } }
        ])
      : [];

    // Commodity distribution for purchases (by booking date)
    const purchaseByCommodity = includePurchase
      ? await ConfirmedPurchaseOrder.aggregate([
          activeOrderMatchStage,
          effectiveDateStage,
          dateMatchStage(startDate, endDate),
          {
            $group: {
              _id: { $ifNull: [nonEmptyStringExpr('$commodity'), 'Unknown'] },
              totalOrders: { $sum: 1 },
              totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
              totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } },
              avgRate: { $avg: { $ifNull: ['$rate_per_mt', 0] } },
              minRate: { $min: { $ifNull: ['$rate_per_mt', 0] } },
              maxRate: { $max: { $ifNull: ['$rate_per_mt', 0] } }
            }
          },
          { $sort: { totalAmount: -1 } }
        ])
      : [];

    // Variety breakdown (by booking date)
    const [salesVarietyBreakdown, purchaseVarietyBreakdown, salesPriceTrends, purchasePriceTrends] = await Promise.all([
      includeSales
        ? ConfirmedSalesOrder.aggregate([
            activeOrderMatchStage,
            effectiveDateStage,
            dateMatchStage(startDate, endDate),
            {
              $group: {
                _id: {
                  commodity: { $ifNull: [nonEmptyStringExpr('$commodity'), 'Unknown'] },
                  variety: { $ifNull: [nonEmptyStringExpr('$variety'), 'N/A'] }
                },
                totalOrders: { $sum: 1 },
                totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
                totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
              }
            },
            { $sort: { totalAmount: -1 } }
          ])
        : Promise.resolve([]),
      includePurchase
        ? ConfirmedPurchaseOrder.aggregate([
            activeOrderMatchStage,
            effectiveDateStage,
            dateMatchStage(startDate, endDate),
            {
              $group: {
                _id: {
                  commodity: { $ifNull: [nonEmptyStringExpr('$commodity'), 'Unknown'] },
                  variety: { $ifNull: [nonEmptyStringExpr('$variety'), 'N/A'] }
                },
                totalOrders: { $sum: 1 },
                totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
                totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
              }
            },
            { $sort: { totalAmount: -1 } }
          ])
        : Promise.resolve([]),
      includeSales
        ? ConfirmedSalesOrder.aggregate([
            activeOrderMatchStage,
            effectiveDateStage,
            dateMatchStage(startDate, endDate),
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: '%Y-%m-%d', date: '$_effectiveDate' } },
                  commodity: { $ifNull: [nonEmptyStringExpr('$commodity'), 'Unknown'] }
                },
                avgRate: { $avg: { $ifNull: ['$rate_per_mt', 0] } }
              }
            },
            { $sort: { '_id.date': 1 } }
          ])
        : Promise.resolve([]),
      includePurchase
        ? ConfirmedPurchaseOrder.aggregate([
            activeOrderMatchStage,
            effectiveDateStage,
            dateMatchStage(startDate, endDate),
            {
              $group: {
                _id: {
                  date: { $dateToString: { format: '%Y-%m-%d', date: '$_effectiveDate' } },
                  commodity: { $ifNull: [nonEmptyStringExpr('$commodity'), 'Unknown'] }
                },
                avgRate: { $avg: { $ifNull: ['$rate_per_mt', 0] } }
              }
            },
            { $sort: { '_id.date': 1 } }
          ])
        : Promise.resolve([])
    ]);

    const varietyMap = new Map();
    [...salesVarietyBreakdown, ...purchaseVarietyBreakdown].forEach((item) => {
      const key = `${item._id.commodity}__${item._id.variety}`;
      const existing = varietyMap.get(key) || {
        commodity: item._id.commodity,
        variety: item._id.variety,
        orders: 0,
        amount: 0,
        weight: 0
      };

      existing.orders += item.totalOrders || 0;
      existing.amount += item.totalAmount || 0;
      existing.weight += item.totalWeight || 0;
      varietyMap.set(key, existing);
    });

    const varietyBreakdown = Array.from(varietyMap.values()).sort((a, b) => b.amount - a.amount);

    // Transform price trends for charting
    const commodityPriceTrends = {};
    [...salesPriceTrends, ...purchasePriceTrends].forEach(item => {
      const commodity = item._id.commodity || 'Unknown';
      if (!commodityPriceTrends[commodity]) {
        commodityPriceTrends[commodity] = [];
      }
      commodityPriceTrends[commodity].push({
        date: item._id.date,
        rate: Math.round(item.avgRate * 100) / 100
      });
    });

    res.json({
      success: true,
      orderType: normalizedOrderType,
      year: year ? Number(year) : null,
      salesByCommodity: salesByCommodity.map(c => ({
        commodity: c._id || 'Unknown',
        orders: c.totalOrders,
        amount: Math.round(c.totalAmount * 100) / 100,
        weight: Math.round(c.totalWeight * 1000) / 1000,
        avgRate: Math.round(c.avgRate * 100) / 100,
        minRate: Math.round(c.minRate * 100) / 100,
        maxRate: Math.round(c.maxRate * 100) / 100
      })),
      purchaseByCommodity: purchaseByCommodity.map(c => ({
        commodity: c._id || 'Unknown',
        orders: c.totalOrders,
        amount: Math.round(c.totalAmount * 100) / 100,
        weight: Math.round(c.totalWeight * 1000) / 1000,
        avgRate: Math.round(c.avgRate * 100) / 100,
        minRate: Math.round(c.minRate * 100) / 100,
        maxRate: Math.round(c.maxRate * 100) / 100
      })),
      varietyBreakdown: varietyBreakdown.map(v => ({
        commodity: v.commodity || 'Unknown',
        variety: v.variety || 'N/A',
        orders: v.orders,
        amount: Math.round(v.amount * 100) / 100,
        weight: Math.round(v.weight * 1000) / 1000
      })),
      priceTrends: commodityPriceTrends
    });
  } catch (error) {
    console.error('Commodity analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch commodity analytics' });
  }
});

// Get customer/seller analytics
router.get('/customer', async (req, res) => {
  try {
    const { period = 'all', type = 'purchase', year } = req.query;
    const { startDate, endDate } = getDateRangeForFilters(req.query);

    const Model = type === 'purchase' ? ConfirmedPurchaseOrder : ConfirmedSalesOrder;

    // Top customers (Seller/Supplier from sheet - no account required)
    const topCustomers = await Model.aggregate([
      activeOrderMatchStage,
      effectiveDateStage,
      dateMatchStage(startDate, endDate),
      ...addCustomerNameStages(type),
      {
        $group: {
          _id: '$_customerName',
          customerEmail: { $first: '$_customerEmail' },
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
          totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } },
          avgOrderValue: { $avg: { $ifNull: ['$net_amount', 0] } },
          firstOrder: { $min: '$_effectiveDate' },
          lastOrder: { $max: '$_effectiveDate' }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 }
    ]);

    // Customer order frequency distribution
    const orderFrequency = await Model.aggregate([
      activeOrderMatchStage,
      effectiveDateStage,
      dateMatchStage(startDate, endDate),
      ...addCustomerNameStages(type),
      {
        $group: {
          _id: '$_customerName',
          orderCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $eq: ['$orderCount', 1] }, then: '1 order' },
                { case: { $lte: ['$orderCount', 5] }, then: '2-5 orders' },
                { case: { $lte: ['$orderCount', 10] }, then: '6-10 orders' },
                { case: { $lte: ['$orderCount', 25] }, then: '11-25 orders' },
                { case: { $lte: ['$orderCount', 50] }, then: '26-50 orders' }
              ],
              default: '50+ orders'
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Customer-wise revenue (Seller/Supplier from sheet)
    const customerRevenue = await Model.aggregate([
      activeOrderMatchStage,
      effectiveDateStage,
      dateMatchStage(startDate, endDate),
      ...addCustomerNameStages(type),
      {
        $group: {
          _id: '$_customerName',
          totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } }
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 }
    ]);

    // New vs returning customers (by booking date)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const allCustomersWithOrders = await Model.aggregate([
      activeOrderMatchStage,
      effectiveDateStage,
      ...addCustomerNameStages(type),
      { $group: { _id: '$_customerName', firstOrder: { $min: '$_effectiveDate' }, totalOrders: { $sum: 1 } } }
    ]);

    const newCustomers = allCustomersWithOrders.filter(c => c.firstOrder >= thirtyDaysAgo).length;
    const returningCustomers = allCustomersWithOrders.filter(c => c.totalOrders > 1).length;
    const oneTimeCustomers = allCustomersWithOrders.filter(c => c.totalOrders === 1).length;

    res.json({
      success: true,
      topCustomers: topCustomers.map(c => ({
        customerId: c._id,
        customerName: c._id || 'Unknown',
        customerEmail: c.customerEmail || '',
        totalOrders: c.totalOrders,
        totalAmount: Math.round(c.totalAmount * 100) / 100,
        totalWeight: Math.round(c.totalWeight * 1000) / 1000,
        avgOrderValue: Math.round(c.avgOrderValue * 100) / 100,
        firstOrder: c.firstOrder,
        lastOrder: c.lastOrder
      })),
      orderFrequency: orderFrequency.map(f => ({
        range: f._id,
        count: f.count
      })),
      customerRevenue: customerRevenue.map(c => ({
        customerName: c._id || 'Unknown',
        amount: Math.round(c.totalAmount * 100) / 100
      })),
      customerTypes: {
        new: newCustomers,
        returning: returningCustomers,
        oneTime: oneTimeCustomers,
        total: allCustomersWithOrders.length
      }
    });
  } catch (error) {
    console.error('Customer analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch customer analytics' });
  }
});

// Get comparative analytics (Purchase vs Sales)
router.get('/comparison', async (req, res) => {
  try {
    const { period = 'all', orderType = 'purchase', year, compareYear } = req.query;
    const { startDate, endDate } = getDateRangeForFilters(req.query);
    const { orderType: normalizedOrderType, includeSales, includePurchase } = getOrderTypeFlags(orderType);

    // Sales summary (by booking date)
    const salesSummary = includeSales
      ? await aggregateSummary(ConfirmedSalesOrder, startDate, endDate)
      : { ...EMPTY_SUMMARY };

    // Purchase summary (by booking date)
    const purchaseSummary = includePurchase
      ? await aggregateSummary(ConfirmedPurchaseOrder, startDate, endDate)
      : { ...EMPTY_SUMMARY };

    // Warehouse comparison (by booking date)
    const [salesByWarehouse, purchaseByWarehouse] = await Promise.all([
      includeSales
        ? ConfirmedSalesOrder.aggregate([
            activeOrderMatchStage,
            effectiveDateStage,
            dateMatchStage(startDate, endDate),
            {
              $group: {
                _id: '$warehouse_name',
                orders: { $sum: 1 },
                amount: { $sum: { $ifNull: ['$net_amount', 0] } },
                weight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
              }
            },
            { $sort: { amount: -1 } }
          ])
        : Promise.resolve([]),
      includePurchase
        ? ConfirmedPurchaseOrder.aggregate([
            activeOrderMatchStage,
            effectiveDateStage,
            dateMatchStage(startDate, endDate),
            {
              $group: {
                _id: '$warehouse_name',
                orders: { $sum: 1 },
                amount: { $sum: { $ifNull: ['$net_amount', 0] } },
                weight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
              }
            },
            { $sort: { amount: -1 } }
          ])
        : Promise.resolve([])
    ]);

    // State-wise comparison (by booking date)
    const [salesByState, purchaseByState] = await Promise.all([
      includeSales
        ? ConfirmedSalesOrder.aggregate([
            activeOrderMatchStage,
            effectiveDateStage,
            dateMatchStage(startDate, endDate),
            {
              $group: {
                _id: '$state',
                orders: { $sum: 1 },
                amount: { $sum: { $ifNull: ['$net_amount', 0] } },
                weight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
              }
            },
            { $sort: { amount: -1 } }
          ])
        : Promise.resolve([]),
      includePurchase
        ? ConfirmedPurchaseOrder.aggregate([
            activeOrderMatchStage,
            effectiveDateStage,
            dateMatchStage(startDate, endDate),
            {
              $group: {
                _id: '$state',
                orders: { $sum: 1 },
                amount: { $sum: { $ifNull: ['$net_amount', 0] } },
                weight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
              }
            },
            { $sort: { amount: -1 } }
          ])
        : Promise.resolve([])
    ]);

    // Combine warehouse data for radar chart
    const allWarehouses = new Set([
      ...salesByWarehouse.map(w => w._id),
      ...purchaseByWarehouse.map(w => w._id)
    ]);

    const warehouseComparison = Array.from(allWarehouses).filter(w => w).map(warehouse => {
      const sales = salesByWarehouse.find(w => w._id === warehouse) || { orders: 0, amount: 0, weight: 0 };
      const purchase = purchaseByWarehouse.find(w => w._id === warehouse) || { orders: 0, amount: 0, weight: 0 };
      
      return {
        warehouse: warehouse || 'Unknown',
        salesOrders: sales.orders,
        salesAmount: roundAmount(sales.amount),
        purchaseOrders: purchase.orders,
        purchaseAmount: roundAmount(purchase.amount)
      };
    }).slice(0, 10);

    const requestedYears = [year, compareYear]
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 2000 && value <= 2100);

    const uniqueYears = Array.from(new Set(requestedYears));

    const yearComparison = await Promise.all(
      uniqueYears.map(async (selectedYear) => {
        const yearRange = getDateRangeForFilters(req.query, selectedYear);
        const [sales, purchase] = await Promise.all([
          includeSales
            ? aggregateSummary(ConfirmedSalesOrder, yearRange.startDate, yearRange.endDate)
            : Promise.resolve({ ...EMPTY_SUMMARY }),
          includePurchase
            ? aggregateSummary(ConfirmedPurchaseOrder, yearRange.startDate, yearRange.endDate)
            : Promise.resolve({ ...EMPTY_SUMMARY })
        ]);

        return {
          year: selectedYear,
          sales,
          purchase,
          total: {
            totalOrders: sales.totalOrders + purchase.totalOrders,
            totalAmount: roundAmount(sales.totalAmount + purchase.totalAmount),
            totalWeight: roundWeight(sales.totalWeight + purchase.totalWeight)
          }
        };
      })
    );

    res.json({
      success: true,
      orderType: normalizedOrderType,
      activeYear: year ? Number(year) : null,
      compareYear: compareYear ? Number(compareYear) : null,
      sales: salesSummary,
      purchase: purchaseSummary,
      warehouseComparison,
      yearComparison,
      salesByState: salesByState.filter(s => s._id).map(s => ({
        state: s._id || 'Unknown',
        orders: s.orders,
        amount: roundAmount(s.amount),
        weight: roundWeight(s.weight)
      })),
      purchaseByState: purchaseByState.filter(s => s._id).map(s => ({
        state: s._id || 'Unknown',
        orders: s.orders,
        amount: roundAmount(s.amount),
        weight: roundWeight(s.weight)
      }))
    });
  } catch (error) {
    console.error('Comparison analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch comparison analytics' });
  }
});

// Get tabular report data
router.get('/reports/:reportType', async (req, res) => {
  try {
    const { reportType } = req.params;
    const { period = 'all', page = 1, limit = 50, orderType = 'purchase', year } = req.query;
    const { startDate, endDate } = getDateRangeForFilters(req.query);
    const { orderType: normalizedOrderType, includeSales, includePurchase } = getOrderTypeFlags(orderType);
    let data = [];
    let total = 0;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 50, 1);

    switch (reportType) {
      case 'order-summary':
        // Order Summary Table (by booking date; Customer = Seller/Supplier from sheet)
        const [salesOrdersAgg, purchaseOrdersAgg] = await Promise.all([
          includeSales
            ? ConfirmedSalesOrder.aggregate([
                activeOrderMatchStage,
                effectiveDateStage,
                dateMatchStage(startDate, endDate),
                ...addCustomerNameStages('sales'),
                {
                  $project: {
                    transaction_date: 1,
                    invoice_number: 1,
                    customer_name: { $ifNull: ['$_customerName', { $ifNull: ['$seller_name', 'Unknown'] }] },
                    commodity: 1,
                    variety: 1,
                    net_weight_mt: 1,
                    net_amount: 1,
                    _effectiveDate: 1
                  }
                }
              ])
            : Promise.resolve([]),
          includePurchase
            ? ConfirmedPurchaseOrder.aggregate([
                activeOrderMatchStage,
                effectiveDateStage,
                dateMatchStage(startDate, endDate),
                ...addCustomerNameStages('purchase'),
                {
                  $project: {
                    transaction_date: 1,
                    invoice_number: 1,
                    customer_name: { $ifNull: ['$_customerName', { $ifNull: ['$supplier_name', 'Unknown'] }] },
                    commodity: 1,
                    variety: 1,
                    net_weight_mt: 1,
                    net_amount: 1,
                    _effectiveDate: 1
                  }
                }
              ])
            : Promise.resolve([])
        ]);

        {
          const combinedRows = [
          ...salesOrdersAgg.map(o => ({
            type: 'Sales',
            date: o.transaction_date || (o._effectiveDate && new Date(o._effectiveDate).toISOString().slice(0, 10)) || 'N/A',
            invoice: o.invoice_number,
            customer: o.customer_name || 'N/A',
            commodity: o.commodity,
            variety: o.variety || 'N/A',
            netWeight: o.net_weight_mt,
            netAmount: o.net_amount
          })),
          ...purchaseOrdersAgg.map(o => ({
            type: 'Purchase',
            date: o.transaction_date || (o._effectiveDate && new Date(o._effectiveDate).toISOString().slice(0, 10)) || 'N/A',
            invoice: o.invoice_number,
            customer: o.customer_name || 'N/A',
            commodity: o.commodity,
            variety: o.variety || 'N/A',
            netWeight: o.net_weight_mt,
            netAmount: o.net_amount
          }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date));
          const paginated = paginateRows(combinedRows, pageNum, limitNum);
          data = paginated.rows;
          total = paginated.total;
        }

        break;

      case 'daily-transaction':
        // Daily Transaction Report (by booking date from sheet)
        const [dailySales, dailyPurchase] = await Promise.all([
          includeSales
            ? ConfirmedSalesOrder.aggregate([
                activeOrderMatchStage,
                effectiveDateStage,
                dateMatchStage(startDate, endDate),
                {
                  $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$_effectiveDate' } },
                    salesOrders: { $sum: 1 },
                    salesAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
                    salesWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
                  }
                }
              ])
            : Promise.resolve([]),
          includePurchase
            ? ConfirmedPurchaseOrder.aggregate([
                activeOrderMatchStage,
                effectiveDateStage,
                dateMatchStage(startDate, endDate),
                {
                  $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$_effectiveDate' } },
                    purchaseOrders: { $sum: 1 },
                    purchaseAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
                    purchaseWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
                  }
                }
              ])
            : Promise.resolve([])
        ]);

        const allDates = new Set([...dailySales.map(d => d._id), ...dailyPurchase.map(d => d._id)]);
        {
          const rows = Array.from(allDates).sort().reverse().map(date => {
          const sales = dailySales.find(d => d._id === date) || { salesOrders: 0, salesAmount: 0, salesWeight: 0 };
          const purchase = dailyPurchase.find(d => d._id === date) || { purchaseOrders: 0, purchaseAmount: 0, purchaseWeight: 0 };
          return {
            date,
            totalOrders: sales.salesOrders + purchase.purchaseOrders,
            salesOrders: sales.salesOrders,
            purchaseOrders: purchase.purchaseOrders,
            totalAmount: sales.salesAmount + purchase.purchaseAmount,
            salesAmount: sales.salesAmount,
            purchaseAmount: purchase.purchaseAmount,
            totalWeight: sales.salesWeight + purchase.purchaseWeight
          };
        });
          const paginated = paginateRows(rows, pageNum, limitNum);
          data = paginated.rows;
          total = paginated.total;
        }
        break;

      case 'customer-ledger':
        // Customer Ledger (Customer = Seller from sales + Supplier from purchase; by booking date)
        const [salesBySeller, purchaseBySupplier] = await Promise.all([
          includeSales
            ? ConfirmedSalesOrder.aggregate([
                activeOrderMatchStage,
                effectiveDateStage,
                dateMatchStage(startDate, endDate),
                ...addCustomerNameStages('sales'),
                { $group: { _id: { $ifNull: ['$_customerName', { $ifNull: [nonEmptyStringExpr('$seller_name'), 'Unknown'] }] }, totalOrders: { $sum: 1 }, totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } }, totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } } } },
                { $sort: { totalAmount: -1 } }
              ])
            : Promise.resolve([]),
          includePurchase
            ? ConfirmedPurchaseOrder.aggregate([
                activeOrderMatchStage,
                effectiveDateStage,
                dateMatchStage(startDate, endDate),
                ...addCustomerNameStages('purchase'),
                { $group: { _id: { $ifNull: ['$_customerName', { $ifNull: [nonEmptyStringExpr('$supplier_name'), 'Unknown'] }] }, totalOrders: { $sum: 1 }, totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } }, totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } } } },
                { $sort: { totalAmount: -1 } }
              ])
            : Promise.resolve([])
        ]);
        const customerKeys = new Map();
        salesBySeller.forEach(c => { customerKeys.set(c._id || 'Unknown', { customer: c._id || 'Unknown', totalOrders: c.totalOrders, totalAmount: c.totalAmount, totalWeight: c.totalWeight, type: 'Sales' }); });
        purchaseBySupplier.forEach(c => {
          const key = c._id || 'Unknown';
          if (customerKeys.has(key)) {
            const prev = customerKeys.get(key);
            prev.totalOrders += c.totalOrders;
            prev.totalAmount += c.totalAmount;
            prev.totalWeight += c.totalWeight;
            prev.type = 'Sales & Purchase';
          } else customerKeys.set(key, { customer: key, totalOrders: c.totalOrders, totalAmount: c.totalAmount, totalWeight: c.totalWeight, type: 'Purchase' });
        });
        {
          const rows = Array.from(customerKeys.values()).map(c => ({
          customer: c.customer,
          email: 'N/A',
          totalOrders: c.totalOrders,
          totalAmount: Math.round(c.totalAmount * 100) / 100,
          totalWeight: Math.round(c.totalWeight * 1000) / 1000,
          pending: 0,
          paid: Math.round(c.totalAmount * 100) / 100
        })).sort((a, b) => b.totalAmount - a.totalAmount);
          const paginated = paginateRows(rows, pageNum, limitNum);
          data = paginated.rows;
          total = paginated.total;
        }
        break;

      case 'commodity-price':
        // Commodity Price List (by booking date)
        const [salesCommodityPrices, purchaseCommodityPrices] = await Promise.all([
          includeSales ? ConfirmedSalesOrder.aggregate([
            activeOrderMatchStage,
            effectiveDateStage,
            dateMatchStage(startDate, endDate),
            {
              $group: {
                _id: {
                  commodity: { $ifNull: [nonEmptyStringExpr('$commodity'), 'Unknown'] },
                  variety: { $ifNull: [nonEmptyStringExpr('$variety'), 'N/A'] }
                },
                avgRate: { $avg: { $ifNull: ['$rate_per_mt', 0] } },
                minRate: { $min: { $ifNull: ['$rate_per_mt', 0] } },
                maxRate: { $max: { $ifNull: ['$rate_per_mt', 0] } },
                totalOrders: { $sum: 1 },
                totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
              }
            }
          ]) : Promise.resolve([]),
          includePurchase ? ConfirmedPurchaseOrder.aggregate([
            activeOrderMatchStage,
            effectiveDateStage,
            dateMatchStage(startDate, endDate),
            {
              $group: {
                _id: {
                  commodity: { $ifNull: [nonEmptyStringExpr('$commodity'), 'Unknown'] },
                  variety: { $ifNull: [nonEmptyStringExpr('$variety'), 'N/A'] }
                },
                avgRate: { $avg: { $ifNull: ['$rate_per_mt', 0] } },
                minRate: { $min: { $ifNull: ['$rate_per_mt', 0] } },
                maxRate: { $max: { $ifNull: ['$rate_per_mt', 0] } },
                totalOrders: { $sum: 1 },
                totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
              }
            }
          ]) : Promise.resolve([])
        ]);

        {
          const commodityPriceMap = new Map();
          [...salesCommodityPrices, ...purchaseCommodityPrices].forEach((item) => {
            const key = `${item._id.commodity}__${item._id.variety}`;
            const existing = commodityPriceMap.get(key) || {
              commodity: item._id.commodity || 'Unknown',
              variety: item._id.variety || 'N/A',
              totalAmountForAvg: 0,
              avgSources: 0,
              minRate: Number.POSITIVE_INFINITY,
              maxRate: 0,
              totalOrders: 0,
              totalWeight: 0
            };

            existing.totalAmountForAvg += item.avgRate || 0;
            existing.avgSources += 1;
            existing.minRate = Math.min(existing.minRate, item.minRate || 0);
            existing.maxRate = Math.max(existing.maxRate, item.maxRate || 0);
            existing.totalOrders += item.totalOrders || 0;
            existing.totalWeight += item.totalWeight || 0;
            commodityPriceMap.set(key, existing);
          });

          const rows = Array.from(commodityPriceMap.values())
            .map((c) => ({
              commodity: c.commodity,
              variety: c.variety,
              avgRate: Math.round(((c.totalAmountForAvg / Math.max(c.avgSources, 1)) || 0) * 100) / 100,
              minRate: Math.round((Number.isFinite(c.minRate) ? c.minRate : 0) * 100) / 100,
              maxRate: Math.round((c.maxRate || 0) * 100) / 100,
              totalOrders: c.totalOrders,
              totalWeight: Math.round(c.totalWeight * 1000) / 1000
            }))
            .sort((a, b) => a.commodity.localeCompare(b.commodity) || a.variety.localeCompare(b.variety));

          const paginated = paginateRows(rows, pageNum, limitNum);
          data = paginated.rows;
          total = paginated.total;
        }
        break;

      case 'deduction':
        // Deduction Report (by booking date from sheet)
        {
          const [salesDeductionOrders, purchaseDeductionOrders] = await Promise.all([
            includeSales
              ? ConfirmedSalesOrder.aggregate([
                  activeOrderMatchStage,
                  effectiveDateStage,
                  dateMatchStage(startDate, endDate),
                  { $project: { invoice_number: 1, transaction_date: 1, commodity: 1, deduction_amount_hlw: 1, deduction_amount_moi_bdoi: 1, other_deductions: 1, total_deduction: 1, gross_amount: 1, net_amount: 1, _effectiveDate: 1 } }
                ])
              : Promise.resolve([]),
            includePurchase
              ? ConfirmedPurchaseOrder.aggregate([
                  activeOrderMatchStage,
                  effectiveDateStage,
                  dateMatchStage(startDate, endDate),
                  { $project: { invoice_number: 1, transaction_date: 1, commodity: 1, deduction_amount_hlw: 1, deduction_amount_moi_bddi: 1, other_deductions: 1, total_deduction: 1, gross_amount: 1, net_amount: 1, _effectiveDate: 1 } }
                ])
              : Promise.resolve([])
          ]);

          const rows = [
            ...salesDeductionOrders.map(o => ({
              type: 'Sales',
              invoice: o.invoice_number,
              date: o.transaction_date || (o._effectiveDate && new Date(o._effectiveDate).toISOString().slice(0, 10)) || 'N/A',
              commodity: o.commodity,
              hlwDeduction: o.deduction_amount_hlw || 0,
              moiBdoiDeduction: o.deduction_amount_moi_bdoi || 0,
              otherDeductions: (o.other_deductions || []).reduce((sum, d) => sum + (d.amount || 0), 0),
              totalDeduction: o.total_deduction || 0,
              grossAmount: o.gross_amount || 0,
              netAmount: o.net_amount || 0
            })),
            ...purchaseDeductionOrders.map(o => ({
              type: 'Purchase',
              invoice: o.invoice_number,
              date: o.transaction_date || (o._effectiveDate && new Date(o._effectiveDate).toISOString().slice(0, 10)) || 'N/A',
              commodity: o.commodity,
              hlwDeduction: o.deduction_amount_hlw || 0,
              moiBdoiDeduction: o.deduction_amount_moi_bddi || 0,
              otherDeductions: (o.other_deductions || []).reduce((sum, d) => sum + (d.amount || 0), 0),
              totalDeduction: o.total_deduction || 0,
              grossAmount: o.gross_amount || 0,
              netAmount: o.net_amount || 0
            }))
          ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          const paginated = paginateRows(rows, pageNum, limitNum);
          data = paginated.rows;
          total = paginated.total;
        }
        break;

      case 'warehouse-stock':
        // Warehouse Stock Report (by booking date)
        const warehouseIn = await ConfirmedPurchaseOrder.aggregate([
          activeOrderMatchStage,
          effectiveDateStage,
          dateMatchStage(startDate, endDate),
          {
            $group: {
              _id: { warehouse: '$warehouse_name', commodity: '$commodity' },
              quantityIn: { $sum: { $ifNull: ['$net_weight_mt', 0] } },
              ordersIn: { $sum: 1 }
            }
          }
        ]);

        const warehouseOut = await ConfirmedSalesOrder.aggregate([
          activeOrderMatchStage,
          effectiveDateStage,
          dateMatchStage(startDate, endDate),
          {
            $group: {
              _id: { warehouse: '$warehouse_name', commodity: '$commodity' },
              quantityOut: { $sum: { $ifNull: ['$net_weight_mt', 0] } },
              ordersOut: { $sum: 1 }
            }
          }
        ]);

        const warehouseKeys = new Set([
          ...warehouseIn.map(w => `${w._id.warehouse}|${w._id.commodity}`),
          ...warehouseOut.map(w => `${w._id.warehouse}|${w._id.commodity}`)
        ]);

        {
          const rows = Array.from(warehouseKeys).map(key => {
          const [warehouse, commodity] = key.split('|');
          const inData = warehouseIn.find(w => w._id.warehouse === warehouse && w._id.commodity === commodity) || { quantityIn: 0, ordersIn: 0 };
          const outData = warehouseOut.find(w => w._id.warehouse === warehouse && w._id.commodity === commodity) || { quantityOut: 0, ordersOut: 0 };
          return {
            warehouse: warehouse || 'Unknown',
            commodity: commodity || 'Unknown',
            quantityIn: Math.round(inData.quantityIn * 1000) / 1000,
            quantityOut: Math.round(outData.quantityOut * 1000) / 1000,
            balance: Math.round((inData.quantityIn - outData.quantityOut) * 1000) / 1000,
            ordersIn: inData.ordersIn,
            ordersOut: outData.ordersOut
          };
        }).filter(d => d.warehouse !== 'Unknown');
          const paginated = paginateRows(rows, pageNum, limitNum);
          data = paginated.rows;
          total = paginated.total;
        }
        break;

      case 'vehicle':
        // Vehicle-wise Report (by booking date)
        {
          const [salesVehicleData, purchaseVehicleData] = await Promise.all([
            includeSales
              ? ConfirmedSalesOrder.aggregate([
                  activeOrderMatchStage,
                  effectiveDateStage,
                  dateMatchStage(startDate, endDate),
                  {
                    $group: {
                      _id: '$vehicle_no',
                      trips: { $sum: 1 },
                      totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } },
                      totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
                      commodities: { $addToSet: '$commodity' }
                    }
                  },
                  { $sort: { totalAmount: -1 } }
                ])
              : Promise.resolve([]),
            includePurchase
              ? ConfirmedPurchaseOrder.aggregate([
                  activeOrderMatchStage,
                  effectiveDateStage,
                  dateMatchStage(startDate, endDate),
                  {
                    $group: {
                      _id: '$vehicle_no',
                      trips: { $sum: 1 },
                      totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } },
                      totalAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
                      commodities: { $addToSet: '$commodity' }
                    }
                  },
                  { $sort: { totalAmount: -1 } }
                ])
              : Promise.resolve([])
          ]);

          const rows = [...salesVehicleData, ...purchaseVehicleData]
            .filter(v => v._id && v._id !== 'N/A')
            .map(v => ({
              type: salesVehicleData.includes(v) ? 'Sales' : 'Purchase',
              vehicleNo: v._id,
              trips: v.trips,
              totalWeight: roundWeight(v.totalWeight),
              totalAmount: roundAmount(v.totalAmount),
              commodities: v.commodities.join(', ')
            }));
          const paginated = paginateRows(rows, pageNum, limitNum);
          data = paginated.rows;
          total = paginated.total;
        }
        break;

      case 'quality':
        // Quality Report (by booking date from sheet)
        {
          const [salesQualityOrders, purchaseQualityOrders] = await Promise.all([
            includeSales
              ? ConfirmedSalesOrder.aggregate([
                  activeOrderMatchStage,
                  effectiveDateStage,
                  dateMatchStage(startDate, endDate),
                  { $project: { invoice_number: 1, transaction_date: 1, commodity: 1, variety: 1, hlw_wheat: 1, moisture_moi: 1, bdoi: 1, moi_bdoi: 1, total_deduction: 1, _effectiveDate: 1 } }
                ])
              : Promise.resolve([]),
            includePurchase
              ? ConfirmedPurchaseOrder.aggregate([
                  activeOrderMatchStage,
                  effectiveDateStage,
                  dateMatchStage(startDate, endDate),
                  { $project: { invoice_number: 1, transaction_date: 1, commodity: 1, variety: 1, hlw_wheat: 1, moisture_moi: 1, bddi: 1, moi_bddi: 1, total_deduction: 1, _effectiveDate: 1 } }
                ])
              : Promise.resolve([])
          ]);

          const rows = [...salesQualityOrders.map((o) => ({ ...o, type: 'Sales' })), ...purchaseQualityOrders.map((o) => ({ ...o, type: 'Purchase' }))]
            .map((o) => {
              let grade = 'A';
              const moisture = o.moisture_moi || 0;
              const bdoiValue = o.bdoi || o.bddi || 0;
              if (moisture > 14 || bdoiValue > 5) grade = 'B';
              if (moisture > 16 || bdoiValue > 8) grade = 'C';
              if (moisture > 18 || bdoiValue > 10) grade = 'D';

              return {
                type: o.type,
                invoice: o.invoice_number,
                date: o.transaction_date || (o._effectiveDate && new Date(o._effectiveDate).toISOString().slice(0, 10)) || 'N/A',
                commodity: o.commodity,
                variety: o.variety || 'N/A',
                hlw: o.hlw_wheat || 'N/A',
                moisture: moisture,
                bdoi: bdoiValue,
                moiBdoi: o.moi_bdoi || o.moi_bddi || 0,
                totalDeduction: o.total_deduction || 0,
                qualityGrade: grade
              };
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

          const paginated = paginateRows(rows, pageNum, limitNum);
          data = paginated.rows;
          total = paginated.total;
        }
        break;

      case 'state-summary':
        // State-wise Summary (by booking date)
        const [stateSales, statePurchase] = await Promise.all([
          includeSales
            ? ConfirmedSalesOrder.aggregate([
                activeOrderMatchStage,
                effectiveDateStage,
                dateMatchStage(startDate, endDate),
                {
                  $group: {
                    _id: '$state',
                    salesOrders: { $sum: 1 },
                    salesAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
                    salesWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
                  }
                }
              ])
            : Promise.resolve([]),
          includePurchase
            ? ConfirmedPurchaseOrder.aggregate([
                activeOrderMatchStage,
                effectiveDateStage,
                dateMatchStage(startDate, endDate),
                {
                  $group: {
                    _id: '$state',
                    purchaseOrders: { $sum: 1 },
                    purchaseAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
                    purchaseWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
                  }
                }
              ])
            : Promise.resolve([])
        ]);

        const allStates = new Set([...stateSales.map(s => s._id), ...statePurchase.map(s => s._id)]);
        {
          const rows = Array.from(allStates).filter(s => s && s !== 'N/A').map(state => {
          const sales = stateSales.find(s => s._id === state) || { salesOrders: 0, salesAmount: 0, salesWeight: 0 };
          const purchase = statePurchase.find(s => s._id === state) || { purchaseOrders: 0, purchaseAmount: 0, purchaseWeight: 0 };
          return {
            state,
            totalOrders: sales.salesOrders + purchase.purchaseOrders,
            salesOrders: sales.salesOrders,
            purchaseOrders: purchase.purchaseOrders,
            totalAmount: Math.round((sales.salesAmount + purchase.purchaseAmount) * 100) / 100,
            salesAmount: Math.round(sales.salesAmount * 100) / 100,
            purchaseAmount: Math.round(purchase.purchaseAmount * 100) / 100,
            totalWeight: Math.round((sales.salesWeight + purchase.purchaseWeight) * 1000) / 1000
          };
        }).sort((a, b) => b.totalAmount - a.totalAmount);
          const paginated = paginateRows(rows, pageNum, limitNum);
          data = paginated.rows;
          total = paginated.total;
        }
        break;

      case 'monthly-pl':
        // Monthly P&L Statement (by booking date from sheet)
        const [monthlySales, monthlyPurchase] = await Promise.all([
          includeSales
            ? ConfirmedSalesOrder.aggregate([
                activeOrderMatchStage,
                effectiveDateStage,
                dateMatchStage(startDate, endDate),
                {
                  $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$_effectiveDate' } },
                    grossAmount: { $sum: { $ifNull: ['$gross_amount', 0] } },
                    totalDeductions: { $sum: { $ifNull: ['$total_deduction', 0] } },
                    netAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
                    totalOrders: { $sum: 1 },
                    totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
                  }
                }
              ])
            : Promise.resolve([]),
          includePurchase
            ? ConfirmedPurchaseOrder.aggregate([
                activeOrderMatchStage,
                effectiveDateStage,
                dateMatchStage(startDate, endDate),
                {
                  $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$_effectiveDate' } },
                    grossAmount: { $sum: { $ifNull: ['$gross_amount', 0] } },
                    totalDeductions: { $sum: { $ifNull: ['$total_deduction', 0] } },
                    netAmount: { $sum: { $ifNull: ['$net_amount', 0] } },
                    totalOrders: { $sum: 1 },
                    totalWeight: { $sum: { $ifNull: ['$net_weight_mt', 0] } }
                  }
                }
              ])
            : Promise.resolve([])
        ]);

        {
          const monthMap = new Map();
          [...monthlySales, ...monthlyPurchase].forEach((item) => {
            const existing = monthMap.get(item._id) || {
              _id: item._id,
              grossAmount: 0,
              totalDeductions: 0,
              netAmount: 0,
              totalOrders: 0,
              totalWeight: 0
            };
            existing.grossAmount += item.grossAmount || 0;
            existing.totalDeductions += item.totalDeductions || 0;
            existing.netAmount += item.netAmount || 0;
            existing.totalOrders += item.totalOrders || 0;
            existing.totalWeight += item.totalWeight || 0;
            monthMap.set(item._id, existing);
          });

          const mergedMonthly = Array.from(monthMap.values()).sort((a, b) => b._id.localeCompare(a._id));
          const rows = mergedMonthly.map((m, index, arr) => {
          const prevMonth = arr[index + 1];
          const growth = prevMonth?.netAmount
            ? ((m.netAmount - prevMonth.netAmount) / prevMonth.netAmount * 100)
            : 0;
          return {
            month: m._id,
            grossAmount: Math.round(m.grossAmount * 100) / 100,
            totalDeductions: Math.round(m.totalDeductions * 100) / 100,
            netAmount: Math.round(m.netAmount * 100) / 100,
            totalOrders: m.totalOrders,
            totalWeight: Math.round(m.totalWeight * 1000) / 1000,
            growthPercent: Math.round(growth * 100) / 100
          };
        });
          const paginated = paginateRows(rows, pageNum, limitNum);
          data = paginated.rows;
          total = paginated.total;
        }
        break;

      default:
        return res.status(400).json({ error: 'Invalid report type' });
    }

    res.json({
      success: true,
      reportType,
      orderType: normalizedOrderType,
      activeYear: year ? Number(year) : null,
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate report' });
  }
});

export default router;
