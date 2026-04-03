// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { verifyWebhookSignature } from './webhook'

const SECRET = 'test-webhook-secret'

function sign(payload: string): string {
  const hmac = createHmac('sha256', SECRET).update(payload).digest('hex')
  return `sha256=${hmac}`
}

describe('verifyWebhookSignature', () => {
  it('accepts valid signature', () => {
    const payload = '{"action":"push"}'
    expect(verifyWebhookSignature(payload, sign(payload), SECRET)).toBe(true)
  })

  it('rejects invalid signature', () => {
    const payload = '{"action":"push"}'
    expect(verifyWebhookSignature(payload, 'sha256=invalid', SECRET)).toBe(false)
  })

  it('rejects missing sha256 prefix', () => {
    const payload = '{"action":"push"}'
    const hmac = createHmac('sha256', SECRET).update(payload).digest('hex')
    expect(verifyWebhookSignature(payload, hmac, SECRET)).toBe(false)
  })

  it('rejects tampered payload', () => {
    const original = '{"action":"push"}'
    const tampered = '{"action":"delete"}'
    expect(verifyWebhookSignature(tampered, sign(original), SECRET)).toBe(false)
  })
})
