-- Fix default embedding model to match the actual installed Ollama model
ALTER TABLE team_settings
  ALTER COLUMN ollama_model SET DEFAULT 'rjmalagon/gte-qwen2-1.5b-instruct-embed-f16';

-- Update any existing rows still using the old default
UPDATE team_settings
  SET ollama_model = 'rjmalagon/gte-qwen2-1.5b-instruct-embed-f16'
  WHERE ollama_model = 'gte-qwen2-1.5b-instruct';
