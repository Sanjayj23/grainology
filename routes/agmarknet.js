import express from 'express';
import {
  getAgmarknetFilters,
  getCachedStateIds,
  getMarketwiseData,
} from '../services/agmarknetService.js';

const router = express.Router();

const sendMarketwise = async (req, res) => {
  try {
    const result = await getMarketwiseData(req.body, { forceRefresh: req.body?.force === true });
    res.json({
      status: 'success',
      success: true,
      stale: Boolean(result.stale),
      source: result.source,
      cached: Boolean(result.cached),
      columns: result.columns || [],
      records: result.records || [],
      reported_dates: result.reportedDates || [],
      fetched_at: result.fetchedAt || result.updatedAt,
      warning: result.warning,
    });
  } catch (error) {
    console.error('Marketwise Agmarknet error:', error.message);
    res.status(502).json({ status: 'error', success: false, error: error.message });
  }
};

router.post('/marketwise', sendMarketwise);
router.post('/marketwise-price-arrival', sendMarketwise);

router.get('/filters', async (req, res) => {
  try {
    const [result, cachedStateIds] = await Promise.all([
      getAgmarknetFilters({ forceRefresh: req.query.force === 'true' }),
      getCachedStateIds(),
    ]);
    res.json({
      source: result.source,
      stale: Boolean(result.stale),
      live_available: result.source === 'agmarknet-live',
      cached_state_ids: cachedStateIds,
      data: result.raw,
    });
  } catch (error) {
    console.error('Agmarknet filters error:', error.message);
    res.status(503).json({ success: false, error: error.message });
  }
});

router.post('/sync', async (req, res) => {
  if (!process.env.CRON_SECRET || req.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const [marketwise, filters] = await Promise.all([
      getMarketwiseData({}, { forceRefresh: true }),
      getAgmarknetFilters({ forceRefresh: true }),
    ]);
    return res.json({
      success: true,
      records: marketwise.count,
      dataSource: marketwise.source,
      filtersUpdated: Boolean(filters.success),
    });
  } catch (error) {
    return res.status(503).json({ success: false, error: error.message });
  }
});


export default router;
