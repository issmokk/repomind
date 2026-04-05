export function getWebhookUrl(): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)

  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL or VERCEL_URL must be set for webhook URL generation')
  }

  const base = appUrl.replace(/\/$/, '')
  return `${base}/api/webhooks/github`
}

export function getWebhookUrlSafe(): string | null {
  try {
    return getWebhookUrl()
  } catch {
    return null
  }
}
