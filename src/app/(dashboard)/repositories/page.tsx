import { FolderGit2 } from 'lucide-react';

export default function RepositoriesPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <FolderGit2 className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Repositories</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Connect and manage your GitHub repositories for indexing.
        </p>
      </div>
    </div>
  );
}
