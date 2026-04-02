// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@octokit/auth-app', () => ({
  createAppAuth: vi.fn(() => vi.fn()),
}))

describe('createGitHubAuth', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.GITHUB_PAT = 'test-pat-token'
    process.env.GITHUB_APP_ID = '12345'
    process.env.GITHUB_APP_PRIVATE_KEY = Buffer.from('-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----').toString('base64')
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns PersonalAccessTokenAuth for pat type', async () => {
    const { createGitHubAuth, PersonalAccessTokenAuth } = await import('./index')
    const auth = createGitHubAuth('pat')
    expect(auth).toBeInstanceOf(PersonalAccessTokenAuth)
  })

  it('returns GitHubAppAuth for github_app type', async () => {
    const { createGitHubAuth } = await import('./index')
    const auth = createGitHubAuth('github_app', { installationId: 999 })
    expect(typeof auth.getHeaders).toBe('function')
  })

  it('throws when github_app type has no installationId', async () => {
    const { createGitHubAuth } = await import('./index')
    expect(() => createGitHubAuth('github_app')).toThrow('installationId is required')
  })

  it('throws for unknown auth type', async () => {
    const { createGitHubAuth } = await import('./index')
    expect(() => createGitHubAuth('unknown' as never)).toThrow('Unknown GitHub auth type')
  })
})
