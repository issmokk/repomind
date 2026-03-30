'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { SourcePanel } from './source-panel';
import { RepoSelector } from './repo-selector';
import { ConversationHistory } from './conversation-history';
import { useChatHistory } from '@/hooks/use-chat-history';
import type { SourceReference } from '@/lib/rag/types';

type Repo = { id: string; name: string; fullName: string };

const transport = new DefaultChatTransport({ api: '/api/chat' });

interface Props {
  conversationId: string;
  repos: Repo[];
}

export function ChatInterface({ conversationId, repos }: Props) {
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>(
    repos.map((r) => r.id),
  );
  const [selectedSources, setSelectedSources] = useState<SourceReference[] | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { messages, sendMessage, status, stop, error } = useChat({
    id: conversationId,
    transport,
  });

  const { groups, isLoading: historyLoading, hasMore, loadMore } = useChatHistory(searchQuery);

  const isLoading = status === 'streaming' || status === 'submitted';
  const isStreaming = status === 'streaming';

  function handleSend() {
    if (inputValue.trim() && !isLoading) {
      sendMessage({ text: inputValue }, { body: { repoIds: selectedRepoIds } });
      setInputValue('');
    }
  }

  return (
    <div className="flex h-full">
      <ConversationHistory
        groups={groups}
        isLoading={historyLoading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />

      <div className={`flex flex-col flex-1 min-w-0 ${messages.length === 0 ? 'justify-center' : 'pb-4'}`}>
        {error && (
          <div className="p-4 text-sm text-destructive border-b bg-destructive/5">
            {error.message}
          </div>
        )}
        {messages.length > 0 && (
          <ChatMessages
            messages={messages}
            status={status}
            onSourceClick={() => setSelectedSources(null)}
          />
        )}
        <div className={`${messages.length === 0 ? 'max-w-2xl mx-auto w-full px-4' : 'px-4'} pb-2`}>
          {messages.length === 0 && (
            <h2 className="text-lg font-medium text-center mb-6 text-muted-foreground">
              Ask a question about your codebase
            </h2>
          )}
          <RepoSelector
            repos={repos}
            selectedIds={selectedRepoIds}
            onSelectionChange={setSelectedRepoIds}
          />
        </div>
        <div className={messages.length === 0 ? 'max-w-2xl mx-auto w-full' : ''}>
          <ChatInput
            input={inputValue}
            onInputChange={setInputValue}
            onSubmit={handleSend}
            onStop={stop}
            isLoading={isLoading}
            isStreaming={isStreaming}
          />
        </div>
      </div>

      <div className="hidden lg:block w-[400px] border-l">
        <SourcePanel sources={selectedSources} />
      </div>
    </div>
  );
}
