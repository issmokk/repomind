// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getWebhookUrl, getWebhookUrlSafe } from './webhook-url'

describe('getWebhookUrl', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('VERCEL_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    process.env = originalEnv
  })

  it('returns URL from NEXT_PUBLIC_APP_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://repomind.example.com')
    expect(getWebhookUrl()).toBe('https://repomind.example.com/api/webhooks/github')
  })

  it('strips trailing slash from NEXT_PUBLIC_APP_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://repomind.example.com/')
    expect(getWebhookUrl()).toBe('https://repomind.example.com/api/webhooks/github')
  })

  it('falls back to VERCEL_URL with https prefix', () => {
    vi.stubEnv('VERCEL_URL', 'my-app-abc123.vercel.app')
    expect(getWebhookUrl()).toBe('https://my-app-abc123.vercel.app/api/webhooks/github')
  })

  it('prefers NEXT_PUBLIC_APP_URL over VERCEL_URL', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://custom.example.com')
    vi.stubEnv('VERCEL_URL', 'my-app.vercel.app')
    expect(getWebhookUrl()).toBe('https://custom.example.com/api/webhooks/github')
  })

  it('throws when neither env var is set', () => {
    expect(() => getWebhookUrl()).toThrow('NEXT_PUBLIC_APP_URL or VERCEL_URL must be set')
  })
})

describe('getWebhookUrlSafe', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('VERCEL_URL', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null when no env vars are set', () => {
    expect(getWebhookUrlSafe()).toBeNull()
  })

  it('returns URL when env var is set', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://repomind.example.com')
    expect(getWebhookUrlSafe()).toBe('https://repomind.example.com/api/webhooks/github')
  })
})
