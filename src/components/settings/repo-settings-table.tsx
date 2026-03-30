'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { Repository, RepositorySettings } from '@/types/repository'

type RepoWithSettings = Repository & { settings?: RepositorySettings }

export function RepoSettingsTable() {
  const { data: repos, mutate } = useSWR<RepoWithSettings[]>('/api/repos', fetcher)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ branchFilter: '', includePatterns: '', excludePatterns: '' })
  const [saving, setSaving] = useState(false)

  async function openEdit(repo: RepoWithSettings) {
    setEditingId(repo.id)
    const res = await fetch(`/api/repos/${repo.id}/settings`)
    if (res.ok) {
      const settings: RepositorySettings = await res.json()
      setEditForm({
        branchFilter: settings.branchFilter.join(', '),
        includePatterns: settings.includePatterns.join(', '),
        excludePatterns: settings.excludePatterns.join(', '),
      })
    }
  }

  async function saveSettings() {
    if (!editingId) return
    setSaving(true)
    try {
      const body = {
        branchFilter: editForm.branchFilter.split(',').map((s) => s.trim()).filter(Boolean),
        includePatterns: editForm.includePatterns.split(',').map((s) => s.trim()).filter(Boolean),
        excludePatterns: editForm.excludePatterns.split(',').map((s) => s.trim()).filter(Boolean),
      }
      const res = await fetch(`/api/repos/${editingId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        toast.success('Repository settings saved')
        setEditingId(null)
        mutate()
      } else {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to save')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  if (!repos) return null

  return (
    <div>
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 text-left font-medium">Repository</th>
              <th className="px-4 py-2 text-left font-medium">Branches</th>
              <th className="px-4 py-2 text-left font-medium">Include</th>
              <th className="px-4 py-2 text-left font-medium">Exclude</th>
              <th className="px-4 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {repos.map((repo) => (
              <tr key={repo.id} className="border-b last:border-0" data-testid={`repo-row-${repo.id}`}>
                <td className="px-4 py-2 font-mono text-xs">{repo.fullName}</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">--</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">--</td>
                <td className="px-4 py-2 text-xs text-muted-foreground">--</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(repo)}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId && (
        <div className="mt-4 rounded-lg border p-4 space-y-3" data-testid="repo-edit-form">
          <h4 className="text-sm font-medium">Edit Repository Settings</h4>
          <div className="space-y-1.5">
            <Label className="text-xs">Branch Filter (comma-separated)</Label>
            <Input
              value={editForm.branchFilter}
              onChange={(e) => setEditForm((f) => ({ ...f, branchFilter: e.target.value }))}
              placeholder="main, develop"
              data-testid="input-branchFilter"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Include Patterns (comma-separated globs)</Label>
            <Input
              value={editForm.includePatterns}
              onChange={(e) => setEditForm((f) => ({ ...f, includePatterns: e.target.value }))}
              placeholder="src/**"
              data-testid="input-includePatterns"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Exclude Patterns (comma-separated globs)</Label>
            <Input
              value={editForm.excludePatterns}
              onChange={(e) => setEditForm((f) => ({ ...f, excludePatterns: e.target.value }))}
              placeholder="node_modules/**, dist/**"
              data-testid="input-excludePatterns"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveSettings} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
