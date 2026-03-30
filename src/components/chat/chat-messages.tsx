'use client';

import { useEffect, useRef } from 'react';
import type { UIMessage } from 'ai';
import { MessagePartRenderer } from './message-part-renderer';
import { ConfidenceBadge } from './confidence-badge';
import { FeedbackButtons } from './feedback-buttons';
import { ChatMessageSkeleton } from '@/components/shared/skeletons';

type Props = {
  messages: UIMessage[];
  status: string;
  onSourceClick?: (url: string) => void;
};

export function ChatMessages({ messages, status, onSourceClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite">
      {messages.map((message) => {
        const isUser = message.role === 'user';

        return (
          <div
            key={message.id}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              <div className="space-y-1">
                {message.parts.map((part, i) => (
                  <MessagePartRenderer
                    key={i}
                    part={part as { type: string; [key: string]: unknown }}
                    onSourceClick={onSourceClick}
                  />
                ))}
              </div>
              {!isUser && message.parts.length > 0 && (
                <div className="flex items-center gap-2 mt-2">
                  <ConfidenceBadge confidence="medium" />
                  <FeedbackButtons messageId={message.id} />
                </div>
              )}
            </div>
          </div>
        );
      })}
      {status === 'streaming' && (
        <div data-testid="streaming-indicator" className="flex justify-start">
          <ChatMessageSkeleton />
        </div>
      )}
    </div>
  );
}
