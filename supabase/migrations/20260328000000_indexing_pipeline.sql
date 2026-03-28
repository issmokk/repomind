-- Indexing Pipeline Schema
-- Creates all tables, indexes, RLS policies, and functions for RepoMind's code indexing pipeline.

-- ============================================================
-- Custom Enum Types
-- ============================================================

CREATE TYPE github_auth_type AS ENUM ('pat', 'github_app');
CREATE TYPE indexing_job_status AS ENUM ('pending', 'fetching_files', 'processing', 'embedding', 'completed', 'failed', 'partial');
CREATE TYPE indexing_job_trigger AS ENUM ('manual', 'git_diff');
CREATE TYPE relationship_type AS ENUM ('calls', 'imports', 'inherits', 'composes', 'depends_on', 'external_dep');

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  full_name text NOT NULL UNIQUE,
  url text NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  last_indexed_commit text,
  github_auth_type github_auth_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE repository_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id uuid NOT NULL UNIQUE REFERENCES repositories(id) ON DELETE CASCADE,
  branch_filter text[] NOT NULL DEFAULT '{main}',
  include_patterns text[] DEFAULT '{}',
  exclude_patterns text[] DEFAULT '{}',
  embedding_provider text NOT NULL DEFAULT 'ollama',
  embedding_model text NOT NULL DEFAULT 'gte-qwen2-1.5b-instruct',
  auto_index_on_add boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cached_files (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  repo_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  content text NOT NULL,
  sha text NOT NULL,
  language text,
  size_bytes integer,
  is_generated boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repo_id, file_path)
);

CREATE TABLE code_chunks (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  repo_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  contextualized_content text NOT NULL,
  language text,
  symbol_name text,
  symbol_type text,
  start_line integer NOT NULL,
  end_line integer NOT NULL,
  parent_scope text,
  commit_sha text,
  embedding vector(1536),
  embedding_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repo_id, file_path, chunk_index)
);

CREATE TABLE graph_edges (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  repo_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  source_file text NOT NULL,
  source_symbol text NOT NULL,
  source_type text,
  target_file text,
  target_symbol text NOT NULL,
  target_type text,
  relationship_type relationship_type NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE indexing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  status indexing_job_status NOT NULL DEFAULT 'pending',
  trigger_type indexing_job_trigger NOT NULL,
  from_commit text,
  to_commit text,
  total_files integer NOT NULL DEFAULT 0,
  processed_files integer NOT NULL DEFAULT 0,
  failed_files integer NOT NULL DEFAULT 0,
  current_file text,
  error_log jsonb DEFAULT '[]',
  last_heartbeat_at timestamptz DEFAULT now(),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- ============================================================
-- Triggers
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_repositories_updated_at
  BEFORE UPDATE ON repositories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_repository_settings_updated_at
  BEFORE UPDATE ON repository_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_cached_files_repo_id ON cached_files (repo_id);

CREATE INDEX idx_code_chunks_embedding ON code_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_code_chunks_repo_id ON code_chunks (repo_id);
CREATE INDEX idx_code_chunks_repo_file ON code_chunks (repo_id, file_path);
CREATE INDEX idx_code_chunks_language ON code_chunks (language);

CREATE INDEX idx_graph_edges_repo_rel ON graph_edges (repo_id, relationship_type);
CREATE INDEX idx_graph_edges_source ON graph_edges (repo_id, source_file, source_symbol);
CREATE INDEX idx_graph_edges_target ON graph_edges (repo_id, target_file, target_symbol);
CREATE INDEX idx_graph_edges_metadata ON graph_edges USING gin (metadata);

CREATE INDEX idx_indexing_jobs_repo_status ON indexing_jobs (repo_id, status);

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE repositories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own org repos" ON repositories
  FOR SELECT USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
CREATE POLICY "Users can insert own org repos" ON repositories
  FOR INSERT WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
CREATE POLICY "Users can update own org repos" ON repositories
  FOR UPDATE USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);
CREATE POLICY "Users can delete own org repos" ON repositories
  FOR DELETE USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

ALTER TABLE repository_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own org settings" ON repository_settings
  FOR SELECT USING (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
CREATE POLICY "Users can insert own org settings" ON repository_settings
  FOR INSERT WITH CHECK (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
CREATE POLICY "Users can update own org settings" ON repository_settings
  FOR UPDATE USING (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
CREATE POLICY "Users can delete own org settings" ON repository_settings
  FOR DELETE USING (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));

ALTER TABLE cached_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own org cached files" ON cached_files
  FOR SELECT USING (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
CREATE POLICY "Users can insert own org cached files" ON cached_files
  FOR INSERT WITH CHECK (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
CREATE POLICY "Users can delete own org cached files" ON cached_files
  FOR DELETE USING (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));

ALTER TABLE code_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own org chunks" ON code_chunks
  FOR SELECT USING (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
CREATE POLICY "Users can insert own org chunks" ON code_chunks
  FOR INSERT WITH CHECK (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
CREATE POLICY "Users can delete own org chunks" ON code_chunks
  FOR DELETE USING (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));

ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own org edges" ON graph_edges
  FOR SELECT USING (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
CREATE POLICY "Users can insert own org edges" ON graph_edges
  FOR INSERT WITH CHECK (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
CREATE POLICY "Users can delete own org edges" ON graph_edges
  FOR DELETE USING (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));

ALTER TABLE indexing_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own org jobs" ON indexing_jobs
  FOR SELECT USING (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
CREATE POLICY "Users can insert own org jobs" ON indexing_jobs
  FOR INSERT WITH CHECK (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
CREATE POLICY "Users can update own org jobs" ON indexing_jobs
  FOR UPDATE USING (repo_id IN (SELECT id FROM repositories WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));

-- ============================================================
-- Functions
-- ============================================================

CREATE OR REPLACE FUNCTION match_code_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  filter_repo_id uuid DEFAULT NULL,
  p_org_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  repo_id uuid,
  file_path text,
  chunk_index integer,
  content text,
  contextualized_content text,
  language text,
  symbol_name text,
  symbol_type text,
  start_line integer,
  end_line integer,
  parent_scope text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  match_count := LEAST(match_count, 100);
  SET LOCAL hnsw.iterative_scan = on;

  RETURN QUERY
  SELECT
    cc.id,
    cc.repo_id,
    cc.file_path,
    cc.chunk_index,
    cc.content,
    cc.contextualized_content,
    cc.language,
    cc.symbol_name,
    cc.symbol_type,
    cc.start_line,
    cc.end_line,
    cc.parent_scope,
    1 - (cc.embedding <=> query_embedding) AS similarity
  FROM code_chunks cc
  JOIN repositories r ON r.id = cc.repo_id
  WHERE
    cc.embedding IS NOT NULL
    AND 1 - (cc.embedding <=> query_embedding) > match_threshold
    AND (filter_repo_id IS NULL OR cc.repo_id = filter_repo_id)
    AND (p_org_id IS NULL OR r.org_id = p_org_id)
  ORDER BY cc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_file_chunks(
  p_repo_id uuid,
  p_file_path text,
  p_chunks jsonb,
  p_org_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_org_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM repositories WHERE id = p_repo_id AND org_id = p_org_id) THEN
      RAISE EXCEPTION 'Repository % does not belong to org %', p_repo_id, p_org_id;
    END IF;
  END IF;

  DELETE FROM code_chunks WHERE repo_id = p_repo_id AND file_path = p_file_path;
  DELETE FROM graph_edges WHERE repo_id = p_repo_id AND (source_file = p_file_path OR target_file = p_file_path);

  INSERT INTO code_chunks (
    repo_id, file_path, chunk_index, content, contextualized_content,
    language, symbol_name, symbol_type, start_line, end_line,
    parent_scope, commit_sha, embedding, embedding_model
  )
  SELECT
    p_repo_id,
    p_file_path,
    (c->>'chunk_index')::integer,
    c->>'content',
    c->>'contextualized_content',
    c->>'language',
    c->>'symbol_name',
    c->>'symbol_type',
    (c->>'start_line')::integer,
    (c->>'end_line')::integer,
    c->>'parent_scope',
    c->>'commit_sha',
    CASE WHEN c->>'embedding' IS NOT NULL THEN (c->>'embedding')::vector(1536) ELSE NULL END,
    c->>'embedding_model'
  FROM jsonb_array_elements(p_chunks) AS c;
END;
$$;
