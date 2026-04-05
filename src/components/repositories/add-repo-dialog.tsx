'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { GitHubRepoPicker } from './github-repo-picker';
import { ManualRepoInput } from './manual-repo-input';

interface AddRepoDialogProps {
  onAdd: (fullName: string) => Promise<string>;
  onTriggerIndex: (repoId: string) => Promise<void>;
}

export function AddRepoDialog({ onAdd, onTriggerIndex }: AddRepoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoIndex, setAutoIndex] = useState(true);

  async function handleAdd(fullName: string) {
    setLoading(true);
    try {
      const repoId = await onAdd(fullName);
      if (autoIndex) {
        try {
          await onTriggerIndex(repoId);
          toast.success('Repository added. Indexing started.');
        } catch {
          toast.success('Repository added, but indexing failed to start. You can trigger it manually.');
        }
      } else {
        toast.success('Repository added');
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add repository');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground gap-1.5"
      >
        <Plus className="size-4" />
        Add Repository
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Repository</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="github">
          <TabsList>
            <TabsTrigger value="github">GitHub</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>
          <TabsContent value="github">
            <GitHubRepoPicker onSelect={handleAdd} loading={loading} />
          </TabsContent>
          <TabsContent value="manual">
            <ManualRepoInput onSubmit={handleAdd} loading={loading} />
          </TabsContent>
        </Tabs>
        <div className="flex items-center gap-2 pt-2 border-t">
          <Checkbox
            id="auto-index"
            checked={autoIndex}
            onCheckedChange={(checked) => setAutoIndex(checked === true)}
          />
          <Label htmlFor="auto-index" className="text-sm cursor-pointer">
            Start indexing immediately
          </Label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
