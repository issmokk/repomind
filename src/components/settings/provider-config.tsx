'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { isMaskedValue } from '@/lib/crypto'

type ProviderConfigProps = {
  provider: string
  config: Record<string, string>
  onChange: (field: string, value: string) => void
  dirtyFields: Set<string>
}

const PROVIDER_FIELDS: Record<string, Array<{ key: string; label: string; type: string; placeholder: string }>> = {
  ollama: [
    { key: 'ollamaBaseUrl', label: 'Base URL', type: 'text', placeholder: 'http://localhost:11434' },
    { key: 'ollamaLlmModel', label: 'LLM Model', type: 'text', placeholder: 'qwen2.5-coder:32b' },
    { key: 'ollamaModel', label: 'Embedding Model', type: 'text', placeholder: 'rjmalagon/gte-qwen2-1.5b-instruct-embed-f16' },
  ],
  claude: [
    { key: 'claudeApiKey', label: 'API Key', type: 'password', placeholder: 'sk-ant-...' },
    { key: 'claudeModel', label: 'Model', type: 'text', placeholder: 'claude-sonnet-4.6' },
  ],
  openai: [
    { key: 'openaiApiKey', label: 'API Key', type: 'password', placeholder: 'sk-...' },
    { key: 'openaiLlmModel', label: 'LLM Model', type: 'text', placeholder: 'gpt-4o' },
    { key: 'openaiModel', label: 'Embedding Model', type: 'text', placeholder: 'text-embedding-3-small' },
  ],
  gemini: [
    { key: 'geminiApiKey', label: 'API Key', type: 'password', placeholder: 'AIzaSy...' },
    { key: 'geminiModel', label: 'LLM Model', type: 'text', placeholder: 'gemini-2.5-flash' },
    { key: 'geminiEmbeddingModel', label: 'Embedding Model', type: 'text', placeholder: 'gemini-embedding-001' },
  ],
  cohere: [
    { key: 'cohereApiKey', label: 'API Key', type: 'password', placeholder: 'API key (optional, for re-ranking)' },
  ],
}

export function ProviderConfig({ provider, config, onChange, dirtyFields }: ProviderConfigProps) {
  const [testResult, setTestResult] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  const fields = PROVIDER_FIELDS[provider] ?? []

  async function testConnection() {
    setTestResult('loading')
    try {
      const res = await fetch('/api/settings/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, config }),
      })
      const data = await res.json()
      setTestResult(data.success ? 'success' : 'error')
      setTestMessage(data.message)
    } catch {
      setTestResult('error')
      setTestMessage('Connection failed')
    }
  }

  return (
    <div className="space-y-3" data-testid={`provider-config-${provider}`}>
      <h3 className="text-sm font-medium capitalize">{provider}</h3>
      {fields.map((field) => {
        const value = config[field.key] ?? ''
        const isApiKey = field.type === 'password'
        const hasSavedKey = isApiKey && isMaskedValue(value) && !dirtyFields.has(field.key)
        return (
          <div key={field.key} className="space-y-1">
            <Label className="text-xs">{field.label}</Label>
            <Input
              type={field.type}
              value={config[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              placeholder={hasSavedKey ? 'Key saved (enter new value to replace)' : field.placeholder}
              data-testid={`input-${field.key}`}
            />
            {hasSavedKey && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="h-3 w-3" /> Key saved securely
              </span>
            )}
            {dirtyFields.has(field.key) && (
              <span className="text-xs text-muted-foreground">Modified</span>
            )}
          </div>
        )
      })}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={testConnection} disabled={testResult === 'loading'}>
          {testResult === 'loading' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Test Connection
        </Button>
        {testResult === 'success' && (
          <span className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" /> {testMessage}
          </span>
        )}
        {testResult === 'error' && (
          <span className="flex items-center gap-1 text-xs text-red-600">
            <XCircle className="h-3 w-3" /> {testMessage}
          </span>
        )}
      </div>
    </div>
  )
}
