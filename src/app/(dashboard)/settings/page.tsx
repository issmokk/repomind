'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { TeamSettings } from '@/types/settings'

const PROVIDERS = ['ollama', 'claude', 'openai'] as const

function isMasked(value: string | null): boolean {
  if (!value) return false
  return /^\*+.{0,4}$/.test(value)
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TeamSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [providerOrder, setProviderOrder] = useState<string[]>(['ollama'])
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('')
  const [ollamaLlmModel, setOllamaLlmModel] = useState('')
  const [claudeApiKey, setClaudeApiKey] = useState('')
  const [claudeModel, setClaudeModel] = useState('')
  const [openaiApiKey, setOpenaiApiKey] = useState('')
  const [openaiLlmModel, setOpenaiLlmModel] = useState('')
  const [cohereApiKey, setCohereApiKey] = useState('')
  const [searchTopK, setSearchTopK] = useState(10)
  const [maxGraphHops, setMaxGraphHops] = useState(2)

  useEffect(() => {
    fetch('/api/settings/team')
      .then((r) => r.json())
      .then((data: TeamSettings) => {
        setSettings(data)
        setProviderOrder(data.providerOrder ?? ['ollama'])
        setOllamaBaseUrl(data.ollamaBaseUrl ?? '')
        setOllamaLlmModel((data as Record<string, unknown>).ollamaLlmModel as string ?? '')
        setClaudeApiKey(data.claudeApiKey ?? '')
        setClaudeModel(data.claudeModel ?? '')
        setOpenaiApiKey(data.openaiApiKey ?? '')
        setOpenaiLlmModel(data.openaiLlmModel ?? '')
        setCohereApiKey(data.cohereApiKey ?? '')
        setSearchTopK(data.searchTopK ?? 10)
        setMaxGraphHops(data.maxGraphHops ?? 2)
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load settings' }))
  }, [])

  async function handleSave() {
    setSaving(true)
    setMessage(null)

    const updates: Record<string, unknown> = { providerOrder, searchTopK, maxGraphHops }

    if (ollamaBaseUrl) updates.ollamaBaseUrl = ollamaBaseUrl
    if (ollamaLlmModel) updates.ollamaLlmModel = ollamaLlmModel
    if (claudeModel) updates.claudeModel = claudeModel
    if (openaiLlmModel) updates.openaiLlmModel = openaiLlmModel
    if (claudeApiKey && !isMasked(claudeApiKey)) updates.claudeApiKey = claudeApiKey
    if (openaiApiKey && !isMasked(openaiApiKey)) updates.openaiApiKey = openaiApiKey
    if (cohereApiKey && !isMasked(cohereApiKey)) updates.cohereApiKey = cohereApiKey

    try {
      const res = await fetch('/api/settings/team', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const err = await res.json()
        setMessage({ type: 'error', text: err.error ?? 'Failed to save' })
      } else {
        const data = await res.json() as TeamSettings
        setSettings(data)
        setClaudeApiKey(data.claudeApiKey ?? '')
        setOpenaiApiKey(data.openaiApiKey ?? '')
        setCohereApiKey(data.cohereApiKey ?? '')
        setMessage({ type: 'success', text: 'Settings saved successfully' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  function moveProvider(index: number, direction: -1 | 1) {
    const newOrder = [...providerOrder]
    const target = index + direction
    if (target < 0 || target >= newOrder.length) return
    ;[newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]]
    setProviderOrder(newOrder)
  }

  function toggleProvider(name: string) {
    if (providerOrder.includes(name)) {
      if (providerOrder.length > 1) {
        setProviderOrder(providerOrder.filter((p) => p !== name))
      }
    } else {
      setProviderOrder([...providerOrder, name])
    }
  }

  if (!settings) {
    return <div className="p-8 text-muted-foreground">Loading settings...</div>
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      {message && (
        <div className={`rounded-lg px-4 py-2 text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200'
            : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium">LLM Provider Configuration</h2>

        <div>
          <label className="text-sm font-medium">Provider Order (fallback chain)</label>
          <div className="flex flex-col gap-1 mt-2">
            {PROVIDERS.map((name) => (
              <div key={name} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={providerOrder.includes(name)}
                  onChange={() => toggleProvider(name)}
                  className="rounded"
                />
                <span className="text-sm flex-1 capitalize">{name}</span>
                {providerOrder.includes(name) && (
                  <span className="text-xs text-muted-foreground">
                    #{providerOrder.indexOf(name) + 1}
                  </span>
                )}
                {providerOrder.includes(name) && (
                  <div className="flex gap-1">
                    <button onClick={() => moveProvider(providerOrder.indexOf(name), -1)} className="text-xs px-1 border rounded">up</button>
                    <button onClick={() => moveProvider(providerOrder.indexOf(name), 1)} className="text-xs px-1 border rounded">dn</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Ollama</h3>
          <div>
            <label className="text-xs text-muted-foreground">Base URL</label>
            <Input value={ollamaBaseUrl} onChange={(e) => setOllamaBaseUrl(e.target.value)} placeholder="http://localhost:11434" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">LLM Model</label>
            <Input value={ollamaLlmModel} onChange={(e) => setOllamaLlmModel(e.target.value)} placeholder="qwen2.5-coder:32b" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Claude (Anthropic)</h3>
          <div>
            <label className="text-xs text-muted-foreground">API Key</label>
            <Input type="password" value={claudeApiKey} onChange={(e) => setClaudeApiKey(e.target.value)} placeholder="sk-ant-..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Model</label>
            <Input value={claudeModel} onChange={(e) => setClaudeModel(e.target.value)} placeholder="claude-sonnet-4.6" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">OpenAI</h3>
          <div>
            <label className="text-xs text-muted-foreground">API Key</label>
            <Input type="password" value={openaiApiKey} onChange={(e) => setOpenaiApiKey(e.target.value)} placeholder="sk-..." />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Model</label>
            <Input value={openaiLlmModel} onChange={(e) => setOpenaiLlmModel(e.target.value)} placeholder="gpt-4o" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Cohere (optional, for re-ranking)</h3>
          <div>
            <label className="text-xs text-muted-foreground">API Key</label>
            <Input type="password" value={cohereApiKey} onChange={(e) => setCohereApiKey(e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium">Search Configuration</h2>
        <div>
          <label className="text-xs text-muted-foreground">Top-K Results (1-50)</label>
          <Input type="number" min={1} max={50} value={searchTopK} onChange={(e) => setSearchTopK(parseInt(e.target.value) || 10)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Max Graph Hops (0-5)</label>
          <Input type="number" min={0} max={5} value={maxGraphHops} onChange={(e) => setMaxGraphHops(parseInt(e.target.value) || 2)} />
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  )
}
