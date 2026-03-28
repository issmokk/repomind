import { Activity } from 'lucide-react';

export default function IndexingPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Activity className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Indexing Status</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Monitor the progress of repository indexing and embedding generation.
        </p>
      </div>
    </div>
  );
}
