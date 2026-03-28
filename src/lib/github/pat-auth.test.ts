// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PersonalAccessTokenAuth } from './pat-auth'

describe('PersonalAccessTokenAuth', () => {
  const originalEnv = process.env.GITHUB_PAT

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.GITHUB_PAT = originalEnv
    } else {
      delete process.env.GITHUB_PAT
    }
  })

  it('returns Authorization header with PAT from env', async () => {
    process.env.GITHUB_PAT = 'ghp_test123'
    const auth = new PersonalAccessTokenAuth()
    const headers = await auth.getHeaders()

    expect(headers.Authorization).toBe('Bearer ghp_test123')
    expect(headers.Accept).toBe('application/vnd.github+json')
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28')
  })

  it('throws if GITHUB_PAT not set', async () => {
    delete process.env.GITHUB_PAT
    const auth = new PersonalAccessTokenAuth()

    await expect(auth.getHeaders()).rejects.toThrow('GITHUB_PAT environment variable is not set')
  })
})
