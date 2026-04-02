// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'fs'
import { parse as parseYaml } from 'yaml'
import { resolve } from 'path'

describe('CI workflow', () => {
  let workflow: Record<string, unknown>

  beforeAll(() => {
    const content = readFileSync(
      resolve(__dirname, '../../.github/workflows/ci.yml'),
      'utf-8'
    )
    workflow = parseYaml(content)
  })

  it('ci.yml is valid YAML and parses without errors', () => {
    expect(workflow).toBeDefined()
    expect(workflow.name).toBe('CI')
  })

  it('triggers on pull_request to main and push to main', () => {
    const on = workflow.on as Record<string, unknown>
    expect(on.pull_request).toEqual({ branches: ['main'] })
    expect(on.push).toEqual({ branches: ['main'] })
  })

  it('defines lint-typecheck, test, and migration-check jobs', () => {
    const jobs = workflow.jobs as Record<string, unknown>
    expect(jobs).toHaveProperty('lint-typecheck')
    expect(jobs).toHaveProperty('test')
    expect(jobs).toHaveProperty('migration-check')
  })

  it('lint-typecheck job runs eslint and tsc --noEmit', () => {
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>
    const steps = jobs['lint-typecheck'].steps as Array<Record<string, string>>
    const runSteps = steps.filter((s) => s.run).map((s) => s.run)
    expect(runSteps.some((r) => r.includes('lint'))).toBe(true)
    expect(runSteps.some((r) => r.includes('tsc --noEmit'))).toBe(true)
  })

  it('test job runs npm run test:run', () => {
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>
    const steps = jobs['test'].steps as Array<Record<string, string>>
    const runSteps = steps.filter((s) => s.run).map((s) => s.run)
    expect(runSteps.some((r) => r.includes('test:run'))).toBe(true)
  })

  it('test job uploads coverage artifact', () => {
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>
    const steps = jobs['test'].steps as Array<Record<string, string>>
    const uploadStep = steps.find((s) => s.uses?.includes('upload-artifact'))
    expect(uploadStep).toBeDefined()
    expect(uploadStep?.if).toBe('always()')
  })

  it('migration-check job depends on lint-typecheck and test jobs', () => {
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>
    const needs = jobs['migration-check'].needs as string[]
    expect(needs).toContain('lint-typecheck')
    expect(needs).toContain('test')
  })

  it('migration-check job installs Supabase CLI and runs dry-run validation', () => {
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>
    const steps = jobs['migration-check'].steps as Array<Record<string, string>>
    const usesSteps = steps.filter((s) => s.uses).map((s) => s.uses)
    expect(usesSteps.some((u) => u.includes('supabase/setup-cli'))).toBe(true)
    const runSteps = steps.filter((s) => s.run).map((s) => s.run)
    expect(runSteps.some((r) => r.includes('db push --dry-run'))).toBe(true)
  })

  it('all jobs use the same Node.js version', () => {
    const jobs = workflow.jobs as Record<string, Record<string, unknown>>
    const nodeVersions: string[] = []
    for (const jobName of ['lint-typecheck', 'test']) {
      const steps = jobs[jobName].steps as Array<Record<string, unknown>>
      const setupNode = steps.find((s) =>
        (s.uses as string)?.includes('setup-node')
      )
      const version = (setupNode?.with as Record<string, string>)?.[
        'node-version'
      ]
      if (version) nodeVersions.push(version)
    }
    expect(nodeVersions.length).toBeGreaterThan(0)
    expect(new Set(nodeVersions).size).toBe(1)
  })
})
