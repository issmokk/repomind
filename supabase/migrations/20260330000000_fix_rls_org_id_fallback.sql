-- Fix RLS policies to handle users without org_id in app_metadata.
-- GitHub OAuth users don't get org_id set automatically, so we fall back
-- to the JWT sub claim (user ID) which is what _helpers.ts does server-side.

-- Helper expression: COALESCE(app_metadata.org_id, jwt.sub)

-- Repositories
DROP POLICY IF EXISTS "Users can view own org repos" ON repositories;
CREATE POLICY "Users can view own org repos" ON repositories
  FOR SELECT USING (
    org_id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    )
  );

DROP POLICY IF EXISTS "Users can insert own org repos" ON repositories;
CREATE POLICY "Users can insert own org repos" ON repositories
  FOR INSERT WITH CHECK (
    org_id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    )
  );

DROP POLICY IF EXISTS "Users can update own org repos" ON repositories;
CREATE POLICY "Users can update own org repos" ON repositories
  FOR UPDATE USING (
    org_id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    )
  );

DROP POLICY IF EXISTS "Users can delete own org repos" ON repositories;
CREATE POLICY "Users can delete own org repos" ON repositories
  FOR DELETE USING (
    org_id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    )
  );

-- Chat messages
DROP POLICY IF EXISTS "Users can view own org messages" ON chat_messages;
CREATE POLICY "Users can view own org messages" ON chat_messages
  FOR SELECT USING (
    org_id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    )
  );

DROP POLICY IF EXISTS "Users can insert own org messages" ON chat_messages;
CREATE POLICY "Users can insert own org messages" ON chat_messages
  FOR INSERT WITH CHECK (
    org_id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    )
  );

-- Team settings
DROP POLICY IF EXISTS "Users can view own org team settings" ON team_settings;
CREATE POLICY "Users can view own org team settings" ON team_settings
  FOR SELECT USING (
    org_id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    )
  );

DROP POLICY IF EXISTS "Users can update own org team settings" ON team_settings;
CREATE POLICY "Users can update own org team settings" ON team_settings
  FOR UPDATE USING (
    org_id = COALESCE(
      (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid,
      (auth.jwt() ->> 'sub')::uuid
    )
  );
