-- Fix RLS policies for tables missed in the initial COALESCE migration.
-- indexing_jobs, repository_settings, code_chunks, graph_edges, cached_files, query_feedback
-- all need the COALESCE(org_id, sub) fallback for GitHub OAuth users.

-- Helper: repo_id -> org_id lookup uses repositories table (already fixed)

-- ============================================================
-- indexing_jobs (SELECT, INSERT, UPDATE, DELETE)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own org jobs" ON indexing_jobs;
CREATE POLICY "Users can view own org jobs" ON indexing_jobs
  FOR SELECT USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own org jobs" ON indexing_jobs;
CREATE POLICY "Users can insert own org jobs" ON indexing_jobs
  FOR INSERT WITH CHECK (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own org jobs" ON indexing_jobs;
CREATE POLICY "Users can update own org jobs" ON indexing_jobs
  FOR UPDATE USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own org jobs" ON indexing_jobs;
CREATE POLICY "Users can delete own org jobs" ON indexing_jobs
  FOR DELETE USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

-- ============================================================
-- repository_settings (SELECT, INSERT, UPDATE)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own org repo settings" ON repository_settings;
CREATE POLICY "Users can view own org repo settings" ON repository_settings
  FOR SELECT USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own org repo settings" ON repository_settings;
CREATE POLICY "Users can insert own org repo settings" ON repository_settings
  FOR INSERT WITH CHECK (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own org repo settings" ON repository_settings;
CREATE POLICY "Users can update own org repo settings" ON repository_settings
  FOR UPDATE USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

-- ============================================================
-- code_chunks (SELECT, INSERT, UPDATE, DELETE)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own org chunks" ON code_chunks;
CREATE POLICY "Users can view own org chunks" ON code_chunks
  FOR SELECT USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own org chunks" ON code_chunks;
CREATE POLICY "Users can insert own org chunks" ON code_chunks
  FOR INSERT WITH CHECK (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own org chunks" ON code_chunks;
CREATE POLICY "Users can update own org chunks" ON code_chunks
  FOR UPDATE USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own org chunks" ON code_chunks;
CREATE POLICY "Users can delete own org chunks" ON code_chunks
  FOR DELETE USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

-- ============================================================
-- graph_edges (SELECT, INSERT, DELETE)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own org edges" ON graph_edges;
CREATE POLICY "Users can view own org edges" ON graph_edges
  FOR SELECT USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own org edges" ON graph_edges;
CREATE POLICY "Users can insert own org edges" ON graph_edges
  FOR INSERT WITH CHECK (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own org edges" ON graph_edges;
CREATE POLICY "Users can delete own org edges" ON graph_edges
  FOR DELETE USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

-- ============================================================
-- cached_files (SELECT, INSERT, UPDATE, DELETE)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own org cached files" ON cached_files;
CREATE POLICY "Users can view own org cached files" ON cached_files
  FOR SELECT USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can insert own org cached files" ON cached_files;
CREATE POLICY "Users can insert own org cached files" ON cached_files
  FOR INSERT WITH CHECK (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can update own org cached files" ON cached_files;
CREATE POLICY "Users can update own org cached files" ON cached_files
  FOR UPDATE USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

DROP POLICY IF EXISTS "Users can delete own org cached files" ON cached_files;
CREATE POLICY "Users can delete own org cached files" ON cached_files
  FOR DELETE USING (
    repo_id IN (
      SELECT id FROM repositories WHERE org_id = COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
        (auth.jwt() ->> 'sub')::uuid
      )
    )
  );

-- ============================================================
-- query_feedback (SELECT, INSERT)
-- ============================================================
DROP POLICY IF EXISTS "Users can view own feedback" ON query_feedback;
CREATE POLICY "Users can view own feedback" ON query_feedback
  FOR SELECT USING (
    user_id = (auth.jwt() ->> 'sub')::uuid
  );

DROP POLICY IF EXISTS "Users can insert own feedback" ON query_feedback;
CREATE POLICY "Users can insert own feedback" ON query_feedback
  FOR INSERT WITH CHECK (
    user_id = (auth.jwt() ->> 'sub')::uuid
  );
