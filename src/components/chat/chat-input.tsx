'use client'

import { useRef, type KeyboardEvent } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Repo = { id: string; name: string; fullName: string }

type Props = {
  input: string
  onInputChange: (value: string) => void
  onSubmit: () => void
  isLoading: boolean
  repos: Repo[]
  selectedRepoIds: string[]
  onRepoSelectionChange: (ids: string[]) => void
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  repos,
  selectedRepoIds,
  onRepoSelectionChange,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isLoading) {
        onSubmit()
      }
    }
  }

  function toggleRepo(repoId: string) {
    if (selectedRepoIds.includes(repoId)) {
      onRepoSelectionChange(selectedRepoIds.filter((id) => id !== repoId))
    } else {
      onRepoSelectionChange([...selectedRepoIds, repoId])
    }
  }

  return (
    <div className="border-t p-4 space-y-2">
      {repos.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {repos.map((repo) => (
            <button
              key={repo.id}
              onClick={() => toggleRepo(repo.id)}
              className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                selectedRepoIds.includes(repo.id)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted text-muted-foreground border-border hover:bg-accent'
              }`}
            >
              {repo.name}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); onSubmit() }} className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your code..."
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 max-h-32 overflow-y-auto"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isLoading}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
