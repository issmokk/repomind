'use client'

import type { SourceReference } from '@/lib/rag/types'

function ScoreBar({ score }: { score: number }) {
  const width = Math.min(Math.round(score * 100), 100)
  return (
    <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

export function SourcePanel({ sources }: { sources: SourceReference[] | null }) {
  if (!sources || sources.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
        Select a message to view its sources.
      </div>
    )
  }

  const sorted = [...sources].sort((a, b) => b.relevanceScore - a.relevanceScore)

  return (
    <div className="flex flex-col gap-2 p-4 overflow-y-auto">
      <h3 className="text-sm font-semibold mb-2">Sources ({sorted.length})</h3>
      {sorted.map((source, i) => (
        <div key={i} className="rounded-lg border p-3 text-sm space-y-1">
          <div className="font-mono text-xs font-medium truncate" title={source.filePath}>
            {source.filePath}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>lines {source.lineStart}-{source.lineEnd}</span>
            <ScoreBar score={source.relevanceScore} />
          </div>
          {source.symbolName && (
            <div className="text-xs text-muted-foreground">
              {source.symbolName}{source.symbolType ? ` (${source.symbolType})` : ''}
            </div>
          )}
          <div className="text-xs text-muted-foreground">{source.repoName}</div>
        </div>
      ))}
    </div>
  )
}
