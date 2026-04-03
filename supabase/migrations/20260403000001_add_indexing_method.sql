-- Add indexing_method to repository_settings
-- Allows users to choose how their repo gets re-indexed: manual, webhook, git_diff, or cron.

CREATE TYPE indexing_method AS ENUM ('manual', 'webhook', 'git_diff', 'cron');

ALTER TABLE repository_settings
  ADD COLUMN indexing_method indexing_method NOT NULL DEFAULT 'manual';
