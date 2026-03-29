'use client'

import { useEffect, useRef } from 'react'
import type { UIMessage } from 'ai'
import { ConfidenceBadge } from './confidence-badge'
import type { SourceReference } from '@/lib/rag/types'

type Props = {
  messages: UIMessage[]
  onSelectSources: (sources: SourceReference[]) => void
}

function getMessageText(message: UIMessage): string {
  if (!message.parts || message.parts.length === 0) return ''
  return message.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

export function ChatMessages({ messages, onSelectSources: _onSelectSources }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((message) => {
        const isUser = message.role === 'user'
        const text = getMessageText(message)

        return (
          <div
            key={message.id}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${isUser
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
                }`}
            >
              <div className="text-sm whitespace-pre-wrap">{text}</div>
              {!isUser && text.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <ConfidenceBadge confidence="medium" />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
