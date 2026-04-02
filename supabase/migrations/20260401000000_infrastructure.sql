-- Infrastructure migration: cross-repo linking, GitHub App support, extended enums

-- Extend indexing_job_trigger enum
ALTER TYPE indexing_job_trigger ADD VALUE IF NOT EXISTS 'webhook';
ALTER TYPE indexing_job_trigger ADD VALUE IF NOT EXISTS 'install';

-- Extend relationship_type enum for cross-repo analysis
ALTER TYPE relationship_type ADD VALUE IF NOT EXISTS 'gem_dependency';
ALTER TYPE relationship_type ADD VALUE IF NOT EXISTS 'npm_dependency';
ALTER TYPE relationship_type ADD VALUE IF NOT EXISTS 'event_publish';
ALTER TYPE relationship_type ADD VALUE IF NOT EXISTS 'event_subscribe';

-- Add GitHub App installation ID to repositories
ALTER TABLE repositories ADD COLUMN IF NOT EXISTS github_app_installation_id integer;

-- Add target_repo_id to graph_edges for cross-repo relationships
ALTER TABLE graph_edges ADD COLUMN IF NOT EXISTS target_repo_id uuid REFERENCES repositories(id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target_repo ON graph_edges (target_repo_id) WHERE target_repo_id IS NOT NULL;

-- Create repo_links table (groups of linked repositories)
CREATE TABLE IF NOT EXISTS repo_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_repo_links_updated_at
  BEFORE UPDATE ON repo_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_repo_links_org_id ON repo_links(org_id);

ALTER TABLE repo_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY repo_links_select ON repo_links FOR SELECT
  USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY repo_links_insert ON repo_links FOR INSERT
  WITH CHECK (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY repo_links_update ON repo_links FOR UPDATE
  USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

CREATE POLICY repo_links_delete ON repo_links FOR DELETE
  USING (org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid);

-- Create repo_link_memberships table (join table for links <-> repos)
CREATE TABLE IF NOT EXISTS repo_link_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES repo_links(id) ON DELETE CASCADE,
  repo_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(link_id, repo_id)
);

CREATE INDEX IF NOT EXISTS idx_repo_link_memberships_link_id ON repo_link_memberships(link_id);
CREATE INDEX IF NOT EXISTS idx_repo_link_memberships_repo_id ON repo_link_memberships(repo_id);

ALTER TABLE repo_link_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY repo_link_memberships_select ON repo_link_memberships FOR SELECT
  USING (link_id IN (SELECT id FROM repo_links WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));

CREATE POLICY repo_link_memberships_insert ON repo_link_memberships FOR INSERT
  WITH CHECK (link_id IN (SELECT id FROM repo_links WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));

CREATE POLICY repo_link_memberships_delete ON repo_link_memberships FOR DELETE
  USING (link_id IN (SELECT id FROM repo_links WHERE org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid));
