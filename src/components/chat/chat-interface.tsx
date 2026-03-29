'use client'

import { useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { SourcePanel } from './source-panel'
import { EmptyState } from './empty-state'
import { ErrorDisplay } from './error-display'
import type { SourceReference } from '@/lib/rag/types'

type Repo = { id: string; name: string; fullName: string }

const transport = new DefaultChatTransport({ api: '/api/chat' })

export function ChatInterface({ repos }: { repos: Repo[] }) {
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>(
    repos.length > 0 ? [repos[0].id] : []
  )
  const [selectedSources, setSelectedSources] = useState<SourceReference[] | null>(null)
  const [inputValue, setInputValue] = useState('')

  const { messages, sendMessage, status, error } = useChat({
    transport,
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  function handleSend() {
    if (inputValue.trim() && !isLoading) {
      sendMessage({ text: inputValue }, { body: { repoIds: selectedRepoIds } })
      setInputValue('')
    }
  }

  if (repos.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-col flex-1 min-w-0">
        {error && (
          <div className="p-4">
            <ErrorDisplay error={error} />
          </div>
        )}
        <ChatMessages
          messages={messages}
          onSelectSources={setSelectedSources}
        />
        <ChatInput
          input={inputValue}
          onInputChange={setInputValue}
          onSubmit={handleSend}
          isLoading={isLoading}
          repos={repos}
          selectedRepoIds={selectedRepoIds}
          onRepoSelectionChange={setSelectedRepoIds}
        />
      </div>
      <div className="hidden lg:block w-[400px] border-l">
        <SourcePanel sources={selectedSources} />
      </div>
    </div>
  )
}
