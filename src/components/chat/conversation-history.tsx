'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ConversationGroup {
  label: string;
  conversations: Array<{
    id: string;
    question: string;
    createdAt: string;
  }>;
}

interface Props {
  groups: ConversationGroup[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onDelete?: (id: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ConversationHistory({
  groups,
  isLoading,
  searchQuery,
  onSearchChange,
  onDelete,
  hasMore,
  onLoadMore,
}: Props) {
  const pathname = usePathname();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full w-[260px] border-r bg-surface">
      <div className="p-3 space-y-2">
        <Link href="/chat" className="block">
          <Button variant="outline" className="w-full justify-start gap-2" size="sm">
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </Link>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-md border bg-background pl-8 pr-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 pb-2">
          {isLoading && groups.length === 0 ? (
            <div className="space-y-2 px-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No conversations yet</p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-3">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 py-1">
                  {group.label}
                </p>
                {group.conversations.map((conv) => {
                  const isActive = pathname === `/chat/${conv.id}`;
                  return (
                    <div
                      key={conv.id}
                      onMouseEnter={() => setHoveredId(conv.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="relative"
                    >
                      <Link
                        href={`/chat/${conv.id}`}
                        className={`block rounded-md px-2 py-1.5 text-xs transition-colors ${
                          isActive
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-accent/50'
                        }`}
                      >
                        <span className="line-clamp-1">{conv.question}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {timeAgo(conv.createdAt)}
                        </span>
                      </Link>
                      {hoveredId === conv.id && onDelete && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            onDelete(conv.id);
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-destructive/10"
                          aria-label="Delete conversation"
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
          {hasMore && (
            <button
              onClick={onLoadMore}
              className="w-full text-xs text-muted-foreground py-2 hover:text-foreground transition-colors"
            >
              Load more
            </button>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
