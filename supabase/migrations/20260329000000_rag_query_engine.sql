-- RAG Query Engine Schema
-- Adds hybrid search (vector + FTS with RRF), chat messages, query feedback,
-- and team settings tables for the RAG query engine (split 02).

-- ============================================================
-- 1. Add Full-Text Search to code_chunks
-- ============================================================

ALTER TABLE code_chunks
  ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

CREATE INDEX idx_code_chunks_fts ON code_chunks USING gin (fts);

-- ============================================================
-- 2. RRF Helper Function
-- ============================================================

CREATE OR REPLACE FUNCTION rrf_score(rank int, rrf_k int DEFAULT 60)
RETURNS float
LANGUAGE sql
IMMUTABLE PARALLEL SAFE
AS $$
  SELECT 1.0 / (rank + rrf_k)::float;
$$;

-- ============================================================
-- 3. Hybrid Search Function (replaces match_code_chunks usage)
-- ============================================================

CREATE OR REPLACE FUNCTION hybrid_search_chunks(
  query_embedding vector(1536),
  query_text text,
  match_count int DEFAULT 10,
  filter_repo_ids uuid[] DEFAULT NULL,
  p_org_id uuid DEFAULT NULL,
  rrf_k int DEFAULT 60,
  overfetch_factor int DEFAULT 4
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
  rrf_score float,
  vector_rank int,
  fts_rank int,
  vector_similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  fetch_count int;
  fts_query tsquery;
BEGIN
  fetch_count := LEAST(match_count * overfetch_factor, 200);
  SET LOCAL hnsw.iterative_scan = relaxed_order;

  IF query_text IS NOT NULL AND query_text <> '' THEN
    fts_query := websearch_to_tsquery('english', query_text);
  ELSE
    fts_query := NULL;
  END IF;

  RETURN QUERY
  WITH vector_results AS (
    SELECT
      cc.id AS chunk_id,
      ROW_NUMBER() OVER (ORDER BY cc.embedding <=> query_embedding) AS vrank,
      1 - (cc.embedding <=> query_embedding) AS vsim
    FROM code_chunks cc
    JOIN repositories r ON r.id = cc.repo_id
    WHERE
      cc.embedding IS NOT NULL
      AND (filter_repo_ids IS NULL OR cc.repo_id = ANY(filter_repo_ids))
      AND (p_org_id IS NULL OR r.org_id = p_org_id)
    ORDER BY cc.embedding <=> query_embedding
    LIMIT fetch_count
  ),
  fts_results AS (
    SELECT
      cc.id AS chunk_id,
      ROW_NUMBER() OVER (ORDER BY ts_rank(cc.fts, fts_query) DESC) AS frank
    FROM code_chunks cc
    JOIN repositories r ON r.id = cc.repo_id
    WHERE
      fts_query IS NOT NULL
      AND cc.fts @@ fts_query
      AND (filter_repo_ids IS NULL OR cc.repo_id = ANY(filter_repo_ids))
      AND (p_org_id IS NULL OR r.org_id = p_org_id)
    ORDER BY ts_rank(cc.fts, fts_query) DESC
    LIMIT fetch_count
  ),
  fused AS (
    SELECT
      COALESCE(vr.chunk_id, fr.chunk_id) AS chunk_id,
      COALESCE(rrf_score(vr.vrank::int, rrf_k), 0) + COALESCE(rrf_score(fr.frank::int, rrf_k), 0) AS combined_rrf,
      vr.vrank::int AS v_rank,
      fr.frank::int AS f_rank,
      vr.vsim AS v_similarity
    FROM vector_results vr
    FULL OUTER JOIN fts_results fr ON vr.chunk_id = fr.chunk_id
    ORDER BY combined_rrf DESC
    LIMIT match_count
  )
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
    f.combined_rrf AS rrf_score,
    f.v_rank AS vector_rank,
    f.f_rank AS fts_rank,
    f.v_similarity AS vector_similarity
  FROM fused f
  JOIN code_chunks cc ON cc.id = f.chunk_id
  ORDER BY f.combined_rrf DESC;
END;
$$;

-- ============================================================
-- 4. Chat Messages Table
-- ============================================================

CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_id uuid,
  repo_ids uuid[] NOT NULL,
  question text NOT NULL,
  answer text,
  sources jsonb DEFAULT '[]',
  confidence text CHECK (confidence IN ('high', 'medium', 'low')),
  model_used text,
  provider_used text,
  retrieval_latency_ms integer,
  generation_latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_org_created ON chat_messages (org_id, created_at DESC);
CREATE INDEX idx_chat_messages_user ON chat_messages (user_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org messages" ON chat_messages
  FOR SELECT USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "Users can insert own org messages" ON chat_messages
  FOR INSERT WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 5. Query Feedback Table
-- ============================================================

CREATE TABLE query_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating text NOT NULL CHECK (rating IN ('up', 'down')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX idx_query_feedback_message ON query_feedback (message_id);

ALTER TABLE query_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org feedback" ON query_feedback
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_messages cm
      WHERE cm.id = query_feedback.message_id
        AND cm.org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

CREATE POLICY "Users can insert own org feedback" ON query_feedback
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_messages cm
      WHERE cm.id = query_feedback.message_id
        AND cm.org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
    )
  );

-- ============================================================
-- 6. Team Settings Table
-- ============================================================

CREATE TABLE team_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE,
  embedding_provider text NOT NULL DEFAULT 'ollama',
  ollama_base_url text NOT NULL DEFAULT 'http://localhost:11434',
  ollama_model text NOT NULL DEFAULT 'gte-qwen2-1.5b-instruct',
  openai_model text NOT NULL DEFAULT 'text-embedding-3-small',
  provider_order text[] NOT NULL DEFAULT '{ollama}',
  claude_api_key text,
  claude_model text NOT NULL DEFAULT 'claude-sonnet-4.6',
  openai_api_key text,
  openai_llm_model text NOT NULL DEFAULT 'gpt-4o',
  cohere_api_key text,
  max_graph_hops integer NOT NULL DEFAULT 2,
  search_top_k integer NOT NULL DEFAULT 10,
  search_rrf_k integer NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_team_settings_updated_at
  BEFORE UPDATE ON team_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE team_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org team settings" ON team_settings
  FOR SELECT USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY "Users can update own org team settings" ON team_settings
  FOR UPDATE USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- ============================================================
-- 7. Masking View for Team Settings (hides API keys from client)
-- ============================================================

CREATE OR REPLACE VIEW team_settings_safe AS
SELECT
  id, org_id, embedding_provider, ollama_base_url, ollama_model, openai_model,
  provider_order,
  CASE WHEN claude_api_key IS NOT NULL AND length(claude_api_key) > 4
    THEN '****' || right(claude_api_key, 4)
    ELSE claude_api_key
  END AS claude_api_key,
  claude_model,
  CASE WHEN openai_api_key IS NOT NULL AND length(openai_api_key) > 4
    THEN '****' || right(openai_api_key, 4)
    ELSE openai_api_key
  END AS openai_api_key,
  openai_llm_model,
  CASE WHEN cohere_api_key IS NOT NULL AND length(cohere_api_key) > 4
    THEN '****' || right(cohere_api_key, 4)
    ELSE cohere_api_key
  END AS cohere_api_key,
  max_graph_hops, search_top_k, search_rrf_k, created_at, updated_at
FROM team_settings;
