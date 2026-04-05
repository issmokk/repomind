'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, Copy, ExternalLink, Loader2, Webhook } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { GitHubAuthType } from '@/types/repository'
import type { WebhookInfoResponse } from '@/app/api/repos/[id]/webhook/route'

interface WebhookSetupGuideProps {
  repoId: string
  fullName: string
  githubAuthType: GitHubAuthType
}

export function WebhookSetupGuide({ repoId, fullName, githubAuthType }: WebhookSetupGuideProps) {
  const [info, setInfo] = useState<WebhookInfoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [setting, setSetting] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/repos/${repoId}/webhook`)
      if (res.ok) {
        setInfo(await res.json())
      }
    } catch {
      // Non-critical, guide still works with manual URL
    } finally {
      setLoading(false)
    }
  }, [repoId])

  useEffect(() => {
    fetchInfo()
  }, [fetchInfo])

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleAutoSetup() {
    setSetting(true)
    try {
      const res = await fetch(`/api/repos/${repoId}/webhook`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create webhook')
        return
      }
      if (data.alreadyExists) {
        toast.info('Webhook already configured on this repository')
      } else {
        toast.success('Webhook created successfully')
      }
      await fetchInfo()
    } catch {
      toast.error('Failed to create webhook')
    } finally {
      setSetting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Checking webhook status...
        </CardContent>
      </Card>
    )
  }

  const webhookUrl = info?.webhookUrl
  const isConfigured = !!info?.existingHook

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Webhook Setup</h3>
          {isConfigured ? (
            <Badge variant="default" className="text-[10px]">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Not configured</Badge>
          )}
        </div>

        {isConfigured ? (
          <p className="text-xs text-muted-foreground">
            A webhook is active on <span className="font-mono">{fullName}</span> pointing to this RepoMind instance.
            Push events to the default branch will trigger incremental indexing automatically.
          </p>
        ) : (
          <>
            {githubAuthType === 'github_app' && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  This repo uses GitHub App auth. RepoMind can automatically register the webhook for you.
                </p>
                <Button
                  size="sm"
                  onClick={handleAutoSetup}
                  disabled={setting || !info?.secretConfigured}
                >
                  {setting ? (
                    <>
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    'Auto-configure webhook'
                  )}
                </Button>
                {!info?.secretConfigured && (
                  <p className="text-xs text-destructive">
                    GITHUB_APP_WEBHOOK_SECRET is not set on the server. Configure it before setting up webhooks.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {githubAuthType === 'github_app'
                  ? 'Or configure it manually:'
                  : 'Configure a webhook on GitHub to enable real-time indexing:'}
              </p>

              <ol className="space-y-3 text-xs">
                <li className="space-y-1.5">
                  <span className="font-medium">1. Go to your repository webhook settings</span>
                  <div>
                    <a
                      href={`https://github.com/${fullName}/settings/hooks/new`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {fullName}/settings/hooks
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </li>

                <li className="space-y-1.5">
                  <span className="font-medium">2. Set the Payload URL</span>
                  {webhookUrl ? (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-muted px-2 py-1 font-mono text-[11px] break-all">
                        {webhookUrl}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2"
                        onClick={() => copyToClipboard(webhookUrl)}
                      >
                        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-destructive">
                      Could not determine webhook URL. Set NEXT_PUBLIC_APP_URL or VERCEL_URL.
                    </p>
                  )}
                </li>

                <li className="space-y-1">
                  <span className="font-medium">3. Set Content type</span>
                  <div>
                    <code className="rounded bg-muted px-2 py-0.5 font-mono text-[11px]">application/json</code>
                  </div>
                </li>

                <li className="space-y-1">
                  <span className="font-medium">4. Set the Secret</span>
                  <p className="text-muted-foreground">
                    Use the same value as your <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">GITHUB_APP_WEBHOOK_SECRET</code> environment variable.
                    {!info?.secretConfigured && (
                      <span className="ml-1 text-destructive">(not currently set on the server)</span>
                    )}
                  </p>
                </li>

                <li className="space-y-1">
                  <span className="font-medium">5. Select events</span>
                  <p className="text-muted-foreground">
                    Choose &ldquo;Just the push event&rdquo; (only push events are processed).
                  </p>
                </li>
              </ol>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
