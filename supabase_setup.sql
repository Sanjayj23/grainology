-- 1. Ensure Index exists on cache_key for lightning-fast lookups
CREATE INDEX IF NOT EXISTS idx_agmarknet_marketwise_cache_key 
ON public.agmarknet_marketwise_cache (cache_key);

-- 2. Create the pg_cron extension if not already enabled (Requires Superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 3. Schedule the weekly cleanup job (runs every Sunday at midnight)
-- This deletes rows where expires_at is older than 7 days from now
SELECT cron.schedule(
  'cleanup-agmarknet-cache-weekly',
  '0 0 * * 0',
  $$
    DELETE FROM public.agmarknet_marketwise_cache 
    WHERE expires_at < NOW() - INTERVAL '7 days';
  $$
);
