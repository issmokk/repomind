-- Add cron_interval column to repository_settings for cron-based auto-indexing
ALTER TABLE repository_settings
  ADD COLUMN cron_interval text NOT NULL DEFAULT '24h';

COMMENT ON COLUMN repository_settings.cron_interval IS 'Polling interval for cron indexing method (e.g. 1h, 6h, 12h, 24h, 7d)';
