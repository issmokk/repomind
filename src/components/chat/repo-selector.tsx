'use client';

import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';

type Repo = { id: string; name: string; fullName: string };

interface Props {
  repos: Repo[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function RepoSelector({ repos, selectedIds, onSelectionChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = repos.filter((r) =>
    r.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  const allSelected = selectedIds.length === repos.length;

  function toggleRepo(id: string) {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((s) => s !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  }

  function toggleAll() {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(repos.map((r) => r.id));
    }
  }

  const selectedRepos = repos.filter((r) => selectedIds.includes(r.id));
  const displayChips = selectedRepos.slice(0, 3);
  const remaining = selectedRepos.length - 3;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Select repositories"
        className="flex items-center gap-1.5 flex-wrap rounded-lg border bg-background px-3 py-1.5 text-sm min-h-[36px] w-full"
      >
        {allSelected ? (
          <span className="text-muted-foreground">All repos</span>
        ) : selectedRepos.length === 0 ? (
          <span className="text-muted-foreground">Select repos...</span>
        ) : (
          <>
            {displayChips.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-mono"
              >
                {r.name}
                <X
                  className="h-3 w-3 cursor-pointer"
                  aria-label={`Remove ${r.name}`}
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleRepo(r.id);
                  }}
                />
              </span>
            ))}
            {remaining > 0 && (
              <span className="text-xs text-muted-foreground">+{remaining} more</span>
            )}
          </>
        )}
        <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border bg-popover shadow-md" role="listbox" aria-label="Repository list">
          <div className="p-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search repos..."
              aria-label="Search repositories"
              className="w-full rounded-md border bg-background px-2 py-1 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              role="option"
              aria-selected={allSelected}
              onClick={toggleAll}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
            >
              <input type="checkbox" checked={allSelected} readOnly tabIndex={-1} className="rounded" />
              <span className="font-medium">All repos</span>
            </button>
            {filtered.map((repo) => (
              <button
                key={repo.id}
                role="option"
                aria-selected={selectedIds.includes(repo.id)}
                onClick={() => toggleRepo(repo.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(repo.id)}
                  readOnly
                  tabIndex={-1}
                  className="rounded"
                />
                <span className="font-mono text-xs">{repo.fullName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
