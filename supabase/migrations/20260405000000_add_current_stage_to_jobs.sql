-- Add current_stage column to indexing_jobs for granular pipeline progress
ALTER TABLE indexing_jobs ADD COLUMN current_stage text;
