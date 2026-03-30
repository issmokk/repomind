'use client';

import { useState } from 'react';
import { Search, Lock, Globe, Star, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useGitHubRepos } from '@/hooks/use-github-repos';
import { ScrollArea } from '@/components/ui/scroll-area';
import { createClient } from '@/lib/supabase/client';

interface GitHubRepoPickerProps {
  onSelect: (fullName: string) => void;
  loading?: boolean;
}

export function GitHubRepoPicker({ onSelect, loading }: GitHubRepoPickerProps) {
  const { repos, isLoading, needsReconnect, search, setSearch, loadMore, hasMore } =
    useGitHubRepos();
  const [selected, setSelected] = useState<string | null>(null);

  if (needsReconnect) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-muted-foreground">GitHub token expired. Please re-connect.</p>
        <Button
          onClick={() => {
            const supabase = createClient();
            supabase.auth.signInWithOAuth({
              provider: 'github',
              options: { redirectTo: `${window.location.origin}/auth/callback` },
            });
          }}
        >
          Connect GitHub
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <ScrollArea className="h-[280px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : repos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No repositories found.</p>
        ) : (
          <div className="space-y-0.5">
            {repos.map((repo) => (
              <button
                key={repo.full_name}
                type="button"
                onClick={() => setSelected(repo.full_name)}
                className={`w-full flex items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted ${
                  selected === repo.full_name ? 'bg-muted ring-1 ring-ring' : ''
                }`}
              >
                {repo.private ? (
                  <Lock className="size-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <Globe className="size-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="font-mono text-xs truncate flex-1">{repo.full_name}</span>
                {repo.language && (
                  <span className="text-xs text-muted-foreground shrink-0">{repo.language}</span>
                )}
                {repo.stargazers_count > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                    <Star className="size-3" />
                    {repo.stargazers_count}
                  </span>
                )}
              </button>
            ))}
            {hasMore && (
              <Button variant="ghost" size="sm" className="w-full mt-1" onClick={loadMore}>
                Load more
              </Button>
            )}
          </div>
        )}
      </ScrollArea>

      <Button onClick={() => selected && onSelect(selected)} disabled={!selected || loading}>
        {loading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
        Add
      </Button>
    </div>
  );
}
