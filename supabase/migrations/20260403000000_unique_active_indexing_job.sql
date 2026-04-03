-- Prevent concurrent active indexing jobs for the same repository.
-- Only one job per repo can be in an active status at a time.
CREATE UNIQUE INDEX idx_indexing_jobs_one_active_per_repo
  ON indexing_jobs (repo_id)
  WHERE status IN ('pending', 'fetching_files', 'processing', 'embedding');
