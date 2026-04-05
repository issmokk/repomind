'use client'

import { useState, useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fetcher } from '@/lib/fetcher'
import { toast } from 'sonner'
import { isMaskedValue } from '@/lib/crypto'
import { SettingsSectionSkeleton } from '@/components/shared/skeletons'
import { ProviderChain, type ProviderStatus } from '@/components/settings/provider-chain'
import { ProviderConfig } from '@/components/settings/provider-config'
import { SearchConfig } from '@/components/settings/search-config'
import { RepoSettingsTable } from '@/components/settings/repo-settings-table'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import type { TeamSettings } from '@/types/settings'

const EMBEDDING_FIELDS: Record<string, string> = {
  embeddingProvider: 'Embedding Provider',
  ollamaModel: 'Ollama Embedding Model',
  openaiModel: 'OpenAI Embedding Model',
  geminiEmbeddingModel: 'Gemini Embedding Model',
}

const ALL_PROVIDERS = ['ollama', 'gemini', 'claude', 'openai', 'cohere']

export default function SettingsPage() {
  const { data: settings, isLoading, mutate } = useSWR<TeamSettings>('/api/settings/team', fetcher)

  const [providerOrder, setProviderOrder] = useState<string[] | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [dirtyFields, setDirtyFields] = useState(new Set<string>())
  const [searchValues, setSearchValues] = useState<Record<string, number> | null>(null)
  const [savingLlm, setSavingLlm] = useState(false)
  const [savingSearch, setSavingSearch] = useState(false)
  const [showEmbeddingWarning, setShowEmbeddingWarning] = useState(false)
  const [reindexingAll, setReindexingAll] = useState(false)
  const [showReindexPrompt, setShowReindexPrompt] = useState(false)

  const effectiveOrder = providerOrder ?? settings?.providerOrder ?? ['ollama']
  const effectiveConfig: Record<string, string> = {
    ollamaBaseUrl: settings?.ollamaBaseUrl ?? '',
    ollamaLlmModel: (settings as unknown as Record<string, string>)?.ollamaLlmModel ?? '',
    claudeApiKey: settings?.claudeApiKey ?? '',
    claudeModel: settings?.claudeModel ?? '',
    openaiApiKey: settings?.openaiApiKey ?? '',
    openaiLlmModel: settings?.openaiLlmModel ?? '',
    cohereApiKey: settings?.cohereApiKey ?? '',
    geminiApiKey: settings?.geminiApiKey ?? '',
    geminiModel: settings?.geminiModel ?? '',
    ollamaModel: settings?.ollamaModel ?? '',
    openaiModel: settings?.openaiModel ?? '',
    geminiEmbeddingModel: settings?.geminiEmbeddingModel ?? '',
    ...configValues,
  }

  const providers: ProviderStatus[] = ALL_PROVIDERS.map((name) => ({
    name,
    configured: name === 'ollama'
      ? !!effectiveConfig.ollamaBaseUrl
      : !!effectiveConfig[`${name}ApiKey`] && effectiveConfig[`${name}ApiKey`] !== '',
  }))

  const changedEmbeddingFields = useMemo(() => {
    if (!settings) return []
    return Object.keys(EMBEDDING_FIELDS).filter((field) => {
      if (!dirtyFields.has(field)) return false
      const newValue = configValues[field]
      const oldValue = (settings as unknown as Record<string, string>)[field] ?? ''
      return newValue !== undefined && newValue !== oldValue
    })
  }, [settings, dirtyFields, configValues])

  const handleConfigChange = useCallback((field: string, value: string) => {
    setConfigValues((prev) => ({ ...prev, [field]: value }))
    setDirtyFields((prev) => new Set(prev).add(field))
  }, [])

  const handleSearchChange = useCallback((field: string, value: number) => {
    setSearchValues((prev) => ({ ...(prev ?? {}), [field]: value }))
  }, [])

  function buildLlmUpdates(): Record<string, unknown> {
    const updates: Record<string, unknown> = { providerOrder: effectiveOrder }
    for (const [key, value] of Object.entries(configValues)) {
      if (!dirtyFields.has(key)) continue
      if (key.endsWith('ApiKey') && typeof value === 'string' && isMaskedValue(value)) continue
      updates[key] = value
    }
    return updates
  }

  function handleSaveLlmClick() {
    if (changedEmbeddingFields.length > 0) {
      setShowEmbeddingWarning(true)
      return
    }
    saveLlmSettings()
  }

  async function saveLlmSettings() {
    setShowEmbeddingWarning(false)
    setSavingLlm(true)
    const updates = buildLlmUpdates()

    try {
      const res = await fetch('/api/settings/team', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to save')
      } else {
        toast.success('LLM settings saved')
        setDirtyFields(new Set())
        setConfigValues({})
        mutate()
        if (changedEmbeddingFields.length > 0) {
          setShowReindexPrompt(true)
        }
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSavingLlm(false)
    }
  }

  async function reindexAllRepos() {
    setReindexingAll(true)
    try {
      const res = await fetch('/api/repos/reindex-all', { method: 'POST' })
      if (!res.ok) {
        toast.error('Failed to trigger re-index')
        return
      }
      const data = await res.json()
      if (data.triggered === 0 && data.skipped === 0) {
        toast.info('No repositories to re-index')
      } else {
        toast.success(`Full re-index started for ${data.triggered} ${data.triggered === 1 ? 'repository' : 'repositories'}`)
        if (data.skipped > 0) {
          toast.warning(`${data.skipped} ${data.skipped === 1 ? 'repository was' : 'repositories were'} skipped (already indexing)`)
        }
      }
    } catch {
      toast.error('Network error')
    } finally {
      setReindexingAll(false)
      setShowReindexPrompt(false)
    }
  }

  async function saveSearchSettings() {
    setSavingSearch(true)
    const updates = searchValues ?? {}

    try {
      const res = await fetch('/api/settings/team', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to save')
      } else {
        toast.success('Search settings saved')
        setSearchValues(null)
        mutate()
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSavingSearch(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-[1200px] space-y-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <SettingsSectionSkeleton />
        <SettingsSectionSkeleton />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1200px] space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <Card className="p-6 space-y-6">
        <h2 className="text-lg font-medium">LLM Configuration</h2>

        <ProviderChain
          providerOrder={effectiveOrder}
          providers={providers}
          onReorder={setProviderOrder}
        />

        <div className="space-y-6 border-t pt-4">
          {effectiveOrder.map((provider) => (
            <ProviderConfig
              key={provider}
              provider={provider}
              config={effectiveConfig}
              onChange={handleConfigChange}
              dirtyFields={dirtyFields}
            />
          ))}
        </div>

        {changedEmbeddingFields.length > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-sm">
              <p className="font-medium text-amber-500">Embedding settings changed</p>
              <p className="mt-1 text-muted-foreground">
                Changing {changedEmbeddingFields.map((f) => EMBEDDING_FIELDS[f]).join(', ')} will
                make existing indexed data incompatible. All repositories will need to be re-indexed
                after saving.
              </p>
            </div>
          </div>
        )}

        <Button onClick={handleSaveLlmClick} disabled={savingLlm}>
          {savingLlm ? 'Saving...' : 'Save LLM Settings'}
        </Button>
      </Card>

      <Dialog open={showEmbeddingWarning} onOpenChange={setShowEmbeddingWarning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm embedding settings change</DialogTitle>
            <DialogDescription>
              Changing the embedding model will make all existing indexed data incompatible.
              Search results will be broken until repositories are re-indexed with the new model.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmbeddingWarning(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={saveLlmSettings} disabled={savingLlm}>
              {savingLlm ? 'Saving...' : 'Save anyway'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReindexPrompt} onOpenChange={setShowReindexPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-index all repositories?</DialogTitle>
            <DialogDescription>
              Your embedding settings have changed. Existing search results will be unreliable
              until all repositories are re-indexed with the new model.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReindexPrompt(false)}>
              Later
            </Button>
            <Button onClick={reindexAllRepos} disabled={reindexingAll}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {reindexingAll ? 'Starting...' : 'Re-index All Repositories'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium">Search Configuration</h2>
        <SearchConfig
          maxGraphHops={searchValues?.maxGraphHops ?? settings?.maxGraphHops ?? 2}
          searchTopK={searchValues?.searchTopK ?? settings?.searchTopK ?? 10}
          searchRrfK={searchValues?.searchRrfK ?? settings?.searchRrfK ?? 60}
          onChange={handleSearchChange}
        />
        <Button onClick={saveSearchSettings} disabled={savingSearch}>
          {savingSearch ? 'Saving...' : 'Save Search Settings'}
        </Button>
      </Card>

      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-medium">Repository Settings</h2>
        <p className="text-sm text-muted-foreground">
          Configure indexing settings for each repository. Changes here are synced with individual repo detail pages.
        </p>
        <RepoSettingsTable />
      </Card>
    </div>
  )
}
