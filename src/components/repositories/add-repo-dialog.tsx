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
import { GitHubRepoPicker } from './github-repo-picker';
import { ManualRepoInput } from './manual-repo-input';

interface AddRepoDialogProps {
  onAdd: (fullName: string) => Promise<void>;
}

export function AddRepoDialog({ onAdd }: AddRepoDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAdd(fullName: string) {
    setLoading(true);
    try {
      await onAdd(fullName);
      toast.success('Repository added');
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
      </DialogContent>
    </Dialog>
  );
}
