'use client'

import { useState, useCallback } from 'react'
import useSWR from 'swr'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fetcher } from '@/lib/fetcher'
import { toast } from 'sonner'
import { isMaskedValue } from '@/lib/crypto'
import { SettingsSectionSkeleton } from '@/components/shared/skeletons'
import { ProviderChain, type ProviderStatus } from '@/components/settings/provider-chain'
import { ProviderConfig } from '@/components/settings/provider-config'
import { SearchConfig } from '@/components/settings/search-config'
import { RepoSettingsTable } from '@/components/settings/repo-settings-table'
import type { TeamSettings } from '@/types/settings'

const ALL_PROVIDERS = ['ollama', 'gemini', 'claude', 'openai', 'cohere']

export default function SettingsPage() {
  const { data: settings, isLoading, mutate } = useSWR<TeamSettings>('/api/settings/team', fetcher)

  const [providerOrder, setProviderOrder] = useState<string[] | null>(null)
  const [configValues, setConfigValues] = useState<Record<string, string>>({})
  const [dirtyFields, setDirtyFields] = useState(new Set<string>())
  const [searchValues, setSearchValues] = useState<Record<string, number> | null>(null)
  const [savingLlm, setSavingLlm] = useState(false)
  const [savingSearch, setSavingSearch] = useState(false)

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
    ...configValues,
  }

  const providers: ProviderStatus[] = ALL_PROVIDERS.map((name) => ({
    name,
    configured: name === 'ollama'
      ? !!effectiveConfig.ollamaBaseUrl
      : !!effectiveConfig[`${name}ApiKey`] && effectiveConfig[`${name}ApiKey`] !== '',
  }))

  const handleConfigChange = useCallback((field: string, value: string) => {
    setConfigValues((prev) => ({ ...prev, [field]: value }))
    setDirtyFields((prev) => new Set(prev).add(field))
  }, [])

  const handleSearchChange = useCallback((field: string, value: number) => {
    setSearchValues((prev) => ({ ...(prev ?? {}), [field]: value }))
  }, [])

  async function saveLlmSettings() {
    setSavingLlm(true)
    const updates: Record<string, unknown> = { providerOrder: effectiveOrder }

    for (const [key, value] of Object.entries(configValues)) {
      if (!dirtyFields.has(key)) continue
      if (key.endsWith('ApiKey') && typeof value === 'string' && isMaskedValue(value)) continue
      updates[key] = value
    }

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
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSavingLlm(false)
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

        <Button onClick={saveLlmSettings} disabled={savingLlm}>
          {savingLlm ? 'Saving...' : 'Save LLM Settings'}
        </Button>
      </Card>

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
