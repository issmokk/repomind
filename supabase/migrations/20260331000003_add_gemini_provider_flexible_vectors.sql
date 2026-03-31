SET search_path = public, extensions;

-- Add Gemini provider columns to team_settings
ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS gemini_api_key text,
  ADD COLUMN IF NOT EXISTS gemini_model text NOT NULL DEFAULT 'gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS gemini_embedding_model text NOT NULL DEFAULT 'gemini-embedding-001';

-- Make the embedding column dimension-flexible so different providers (1536, 3072, etc.) can coexist
ALTER TABLE code_chunks ALTER COLUMN embedding TYPE vector USING embedding::vector;

-- Drop the HNSW index (it required fixed dimensions).
-- Cosine distance still works without an index; fine for our scale.
DROP INDEX IF EXISTS idx_code_chunks_embedding;

-- Update match_code_chunks to accept any-dimension vector
CREATE OR REPLACE FUNCTION match_code_chunks(
  query_embedding vector,
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

-- Update hybrid_search_chunks to accept any-dimension vector
CREATE OR REPLACE FUNCTION hybrid_search_chunks(
  query_embedding vector,
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
      COALESCE(vr.vrank, fetch_count + 1)::int AS v_rank,
      COALESCE(fr.frank, fetch_count + 1)::int AS f_rank,
      COALESCE(vr.vsim, 0)::float AS v_sim
    FROM vector_results vr
    FULL OUTER JOIN fts_results fr ON vr.chunk_id = fr.chunk_id
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
    f.combined_rrf::float AS rrf_score,
    f.v_rank AS vector_rank,
    f.f_rank AS fts_rank,
    f.v_sim AS vector_similarity
  FROM fused f
  JOIN code_chunks cc ON cc.id = f.chunk_id
  ORDER BY f.combined_rrf DESC
  LIMIT match_count;
END;
$$;

-- Update upsert_file_chunks to accept any-dimension vector
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
    CASE WHEN c->>'embedding' IS NOT NULL THEN (c->>'embedding')::vector ELSE NULL END,
    c->>'embedding_model'
  FROM jsonb_array_elements(p_chunks) AS c;
END;
$$;
