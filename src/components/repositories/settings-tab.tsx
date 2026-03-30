'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RepositorySettings, RepositorySettingsUpdate } from '@/types/repository';
import type { KeyedMutator } from 'swr';

const INDEXING_METHODS = [
  { value: 'webhook', label: 'Webhook', description: 'Real-time updates. Triggers on every push. Requires GitHub webhook setup.' },
  { value: 'cron', label: 'Cron', description: 'Scheduled polling. Checks for changes every N hours. Simpler setup.' },
  { value: 'manual', label: 'Manual', description: 'User-triggered only. Full control over when indexing happens.' },
  { value: 'git_diff', label: 'Git-diff incremental', description: 'Efficient. Only re-processes files changed since last index.' },
] as const;

interface SettingsTabProps {
  repoId: string;
  settings: RepositorySettings;
  mutateSettings: KeyedMutator<RepositorySettings>;
}

export function SettingsTab({ repoId, settings, mutateSettings }: SettingsTabProps) {
  const [indexingMethod, setIndexingMethod] = useState('manual');
  const [branchFilter, setBranchFilter] = useState<string[]>(settings.branchFilter);
  const [branchInput, setBranchInput] = useState('');
  const [includePatterns, setIncludePatterns] = useState<string[]>(settings.includePatterns);
  const [includeInput, setIncludeInput] = useState('');
  const [excludePatterns, setExcludePatterns] = useState<string[]>(settings.excludePatterns);
  const [excludeInput, setExcludeInput] = useState('');
  const [saving, setSaving] = useState(false);

  const isDirty =
    JSON.stringify(branchFilter) !== JSON.stringify(settings.branchFilter) ||
    JSON.stringify(includePatterns) !== JSON.stringify(settings.includePatterns) ||
    JSON.stringify(excludePatterns) !== JSON.stringify(settings.excludePatterns);

  function addBranch() {
    const val = branchInput.trim();
    if (val && !branchFilter.includes(val)) {
      setBranchFilter([...branchFilter, val]);
    }
    setBranchInput('');
  }

  function removeBranch(branch: string) {
    if (branchFilter.length <= 1) return;
    setBranchFilter(branchFilter.filter((b) => b !== branch));
  }

  function addPattern(type: 'include' | 'exclude') {
    if (type === 'include') {
      const val = includeInput.trim();
      if (val && !includePatterns.includes(val)) {
        setIncludePatterns([...includePatterns, val]);
      }
      setIncludeInput('');
    } else {
      const val = excludeInput.trim();
      if (val && !excludePatterns.includes(val)) {
        setExcludePatterns([...excludePatterns, val]);
      }
      setExcludeInput('');
    }
  }

  function removePattern(type: 'include' | 'exclude', pattern: string) {
    if (type === 'include') {
      setIncludePatterns(includePatterns.filter((p) => p !== pattern));
    } else {
      setExcludePatterns(excludePatterns.filter((p) => p !== pattern));
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: RepositorySettingsUpdate = {};
      if (JSON.stringify(branchFilter) !== JSON.stringify(settings.branchFilter)) {
        body.branchFilter = branchFilter;
      }
      if (JSON.stringify(includePatterns) !== JSON.stringify(settings.includePatterns)) {
        body.includePatterns = includePatterns;
      }
      if (JSON.stringify(excludePatterns) !== JSON.stringify(settings.excludePatterns)) {
        body.excludePatterns = excludePatterns;
      }

      const res = await fetch(`/api/repos/${repoId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to save settings');
        return;
      }

      toast.success('Settings saved');
      const updated = await mutateSettings();
      if (updated) {
        setBranchFilter(updated.branchFilter);
        setIncludePatterns(updated.includePatterns);
        setExcludePatterns(updated.excludePatterns);
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium">Indexing Method</h3>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Coming soon</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {INDEXING_METHODS.map((method) => (
              <label
                key={method.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  indexingMethod === method.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="radio"
                  name="indexingMethod"
                  value={method.value}
                  checked={indexingMethod === method.value}
                  onChange={(e) => setIndexingMethod(e.target.value)}
                  className="mt-0.5"
                />
                <div>
                  <span className="text-sm font-medium">{method.label}</span>
                  <p className="text-xs text-muted-foreground">{method.description}</p>
                </div>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="branch-input">Branch Filter</label>
            <div className="flex gap-2">
              <Input
                id="branch-input"
                value={branchInput}
                onChange={(e) => setBranchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addBranch();
                  }
                }}
                placeholder="Type branch name and press Enter"
              />
              <Button variant="outline" size="sm" onClick={addBranch} type="button">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {branchFilter.map((branch) => (
                <span
                  key={branch}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-mono"
                >
                  {branch}
                  <button
                    type="button"
                    onClick={() => removeBranch(branch)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${branch}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="include-input">Include Patterns</label>
            <div className="flex gap-2">
              <Input
                id="include-input"
                value={includeInput}
                onChange={(e) => setIncludeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPattern('include');
                  }
                }}
                placeholder="e.g. src/**/*.ts"
              />
              <Button variant="outline" size="sm" onClick={() => addPattern('include')} type="button">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {includePatterns.map((pattern) => (
                <span
                  key={pattern}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-mono"
                >
                  {pattern}
                  <button
                    type="button"
                    onClick={() => removePattern('include', pattern)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${pattern}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="exclude-input">Exclude Patterns</label>
            <div className="flex gap-2">
              <Input
                id="exclude-input"
                value={excludeInput}
                onChange={(e) => setExcludeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addPattern('exclude');
                  }
                }}
                placeholder="e.g. node_modules/**"
              />
              <Button variant="outline" size="sm" onClick={() => addPattern('exclude')} type="button">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {excludePatterns.map((pattern) => (
                <span
                  key={pattern}
                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-mono"
                >
                  {pattern}
                  <button
                    type="button"
                    onClick={() => removePattern('exclude', pattern)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Remove ${pattern}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={!isDirty || saving}>
        {saving ? 'Saving...' : 'Save Settings'}
      </Button>
    </div>
  );
}
