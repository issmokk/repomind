import { createHmac, timingSafeEqual } from 'crypto'

export function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  if (!signatureHeader.startsWith('sha256=')) return false

  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  const actual = signatureHeader.slice('sha256='.length)

  if (expected.length !== actual.length) return false

  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
}
