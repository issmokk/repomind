'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Plus, Loader2, Trash2, Play } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { RepoSelector } from './repo-selector';
import type { RepoLinkWithMemberships, AnalysisResult } from '@/types/cross-repo';

interface LinkedReposTabProps {
  repoId: string;
}

const fetcher = (url: string) => fetch(url).then(r => r.json()).then(d => Array.isArray(d) ? d : []);

export function LinkedReposTab({ repoId }: LinkedReposTabProps) {
  const { data: linkGroups, mutate, isLoading } = useSWR<RepoLinkWithMemberships[]>(
    `/api/repos/${repoId}/links`,
    fetcher,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, AnalysisResult>>({});

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/repos/${repoId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), repoIds: selectedRepoIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to create link group');
        return;
      }
      toast.success('Link group created');
      setCreateOpen(false);
      setNewName('');
      setSelectedRepoIds([]);
      mutate();
    } catch {
      toast.error('Failed to create link group');
    } finally {
      setCreating(false);
    }
  }

  async function handleAnalyze(linkId: string) {
    setAnalyzingId(linkId);
    try {
      const res = await fetch(`/api/links/${linkId}/analyze`, { method: 'POST' });
      if (!res.ok) {
        toast.error('Analysis failed');
        return;
      }
      const data: AnalysisResult = await res.json();
      setResults(prev => ({ ...prev, [linkId]: data }));
      toast.success(`Found ${data.edgeCount} cross-repo relationships`);
    } catch {
      toast.error('Analysis failed');
    } finally {
      setAnalyzingId(null);
    }
  }

  async function handleDelete(linkId: string) {
    try {
      const res = await fetch(`/api/links/${linkId}`, { method: 'DELETE' });
      if (!res.ok) {
        toast.error('Failed to delete link group');
        return;
      }
      toast.success('Link group deleted');
      setDeleteId(null);
      mutate();
    } catch {
      toast.error('Failed to delete link group');
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading linked repos...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Link Groups</h3>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Plus className="h-4 w-4 mr-1" />
            Create Link Group
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Link Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="link-name">Group Name</Label>
                <Input
                  id="link-name"
                  placeholder="e.g. Payment Services"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Select Repositories</Label>
                <RepoSelector
                  selectedRepoIds={selectedRepoIds}
                  onSelectionChange={setSelectedRepoIds}
                  excludeRepoId={repoId}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(!linkGroups || linkGroups.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No linked repos yet. Create a link group to analyze cross-repo dependencies.
          </CardContent>
        </Card>
      )}

      {linkGroups?.map(group => (
        <Card key={group.id}>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">{group.name}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {group.repos.length} {group.repos.length === 1 ? 'repo' : 'repos'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAnalyze(group.id)}
                  disabled={analyzingId === group.id}
                >
                  {analyzingId === group.id ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 mr-1" />
                  )}
                  Analyze
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteId(group.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1">
              {group.repos.map(r => (
                <Badge key={r.id} variant="secondary" className="text-xs">
                  {r.name}
                </Badge>
              ))}
            </div>

            {results[group.id] && (
              <div className="border rounded-md p-3 mt-2 space-y-2">
                <p className="text-sm font-medium">
                  {results[group.id].edgeCount} relationships detected
                </p>
                {Object.entries(results[group.id].byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between text-xs">
                    <Badge variant="outline">{type}</Badge>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                ))}
                {results[group.id].skippedRepos.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Skipped {results[group.id].skippedRepos.length} unindexed repos
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <ConfirmationDialog
        open={deleteId !== null}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Link Group"
        description="This will remove the link group and all its memberships. Cross-repo edges from previous analyses will remain."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onCancel={() => setDeleteId(null)}
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  );
}
