import cron from 'node-cron';
import { getAgmarknetFilters, getMarketwiseData } from '../services/agmarknetService.js';

export const syncAgmarknet = async () => {
  console.log(`Starting daily Agmarknet sync at ${new Date().toISOString()}`);
  const marketwise = await getMarketwiseData({}, { forceRefresh: true });
  console.log(`Agmarknet marketwise cache updated with ${marketwise.count} records`);

  try {
    const filters = await getAgmarknetFilters({ forceRefresh: true });
    console.log('Agmarknet filter cache updated');

    if (marketwise.source !== 'agmarknet-live' || filters.source !== 'agmarknet-live') {
      console.warn('Agmarknet is unavailable; skipping per-state cache warming');
      return;
    }

    const stateIds = (filters.states || [])
      .map((state) => Number(state.id))
      .filter((stateId) => Number.isFinite(stateId) && stateId !== 100006);

    for (const state of stateIds) {
      const result = await getMarketwiseData({ state }, { forceRefresh: true });
      if (result.source !== 'agmarknet-live') {
        console.warn(`Stopped state cache warming at state ${state}: live API became unavailable`);
        break;
      }
      console.log(`Agmarknet state ${state} cache updated with ${result.count} records`);
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  } catch (error) {
    console.warn(`Agmarknet filter sync skipped: ${error.message}`);
  }
};

export const startAgmarknetCron = () => {
  const task = cron.schedule('0 30 6 * * *', () => {
    syncAgmarknet().catch((error) => {
      console.error(`Daily Agmarknet sync failed: ${error.message}`);
    });
  }, { timezone: 'Asia/Kolkata' });

  console.log('Agmarknet daily sync scheduled for 6:30 AM Asia/Kolkata');
  return task;
};
