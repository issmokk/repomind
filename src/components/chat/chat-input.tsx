'use client';

import { useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isLoading: boolean;
  isStreaming?: boolean;
};

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  onStop,
  isLoading,
  isStreaming,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, []);

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    onInputChange(e.target.value);
    handleResize();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit();
      }
    }
  }

  return (
    <div className="border-t p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="flex items-end gap-2"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your codebase..."
          disabled={isLoading}
          rows={1}
          className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 max-h-[200px] overflow-y-auto"
        />
        {isStreaming ? (
          <Button type="button" size="icon" variant="outline" onClick={onStop}>
            <Square className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
    </div>
  );
}
