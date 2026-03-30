-- Add missing ollama_llm_model column for LLM chat model (separate from ollama_model which is for embeddings)
ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS ollama_llm_model text NOT NULL DEFAULT 'qwen2.5-coder:32b';

-- Add INSERT policy so upsert can create new rows
DROP POLICY IF EXISTS "Users can insert own org team settings" ON team_settings;
CREATE POLICY "Users can insert own org team settings" ON team_settings
  FOR INSERT WITH CHECK (
    org_id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    )
  );
