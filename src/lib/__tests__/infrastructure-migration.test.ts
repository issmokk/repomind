// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase/migrations/20260401000000_infrastructure.sql',
)

describe('infrastructure migration', () => {
  let sql: string

  beforeAll(() => {
    sql = readFileSync(MIGRATION_PATH, 'utf-8')
  })

  it('creates repo_links table', () => {
    expect(sql).toContain('CREATE TABLE')
    expect(sql).toContain('repo_links')
    expect(sql).toMatch(/org_id\s+uuid\s+NOT NULL/)
    expect(sql).toMatch(/name\s+text\s+NOT NULL/)
  })

  it('creates repo_link_memberships with foreign keys', () => {
    expect(sql).toContain('repo_link_memberships')
    expect(sql).toMatch(/link_id\s+uuid.*REFERENCES\s+repo_links/)
    expect(sql).toMatch(/repo_id\s+uuid.*REFERENCES\s+repositories/)
    expect(sql).toContain('ON DELETE CASCADE')
    expect(sql).toMatch(/UNIQUE\s*\(\s*link_id\s*,\s*repo_id\s*\)/)
  })

  it('adds github_app_installation_id to repositories', () => {
    expect(sql).toContain('github_app_installation_id')
    expect(sql).toContain('ALTER TABLE repositories')
  })

  it('adds target_repo_id to graph_edges', () => {
    expect(sql).toContain('target_repo_id')
    expect(sql).toContain('ALTER TABLE graph_edges')
    expect(sql).toMatch(/REFERENCES\s+repositories\s*\(\s*id\s*\)/)
  })

  it('enables RLS on new tables with org_id policies', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    expect(sql).toContain('repo_links')
    expect(sql).toMatch(/org_id\s*=/)
  })

  it('extends indexing_job_trigger enum', () => {
    expect(sql).toContain("'webhook'")
    expect(sql).toContain("'install'")
    expect(sql).toContain('indexing_job_trigger')
  })

  it('extends relationship_type enum', () => {
    expect(sql).toContain("'gem_dependency'")
    expect(sql).toContain("'npm_dependency'")
    expect(sql).toContain("'event_publish'")
    expect(sql).toContain("'event_subscribe'")
  })
})
