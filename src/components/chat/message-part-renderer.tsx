'use client';

import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; reasoning: string }
  | { type: 'source-url'; url: string; title?: string }
  | { type: string; [key: string]: unknown };

interface Props {
  part: MessagePart;
  onSourceClick?: (url: string) => void;
}

export function MessagePartRenderer({ part, onSourceClick }: Props) {
  if (part.type === 'text') {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none prose-code:font-mono prose-pre:bg-muted prose-pre:rounded-lg">
        <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{String(part.text ?? '')}</ReactMarkdown>
      </div>
    );
  }

  if (part.type === 'reasoning') {
    return (
      <details className="text-xs text-muted-foreground border rounded-md p-2 my-1">
        <summary className="cursor-pointer font-medium">Thinking...</summary>
        <div className="mt-2 prose prose-xs dark:prose-invert max-w-none">
          <ReactMarkdown>{(part as { type: 'reasoning'; reasoning: string }).reasoning}</ReactMarkdown>
        </div>
      </details>
    );
  }

  if (part.type === 'source-url') {
    const sourcePart = part as { type: 'source-url'; url: string; title?: string };
    return (
      <button
        onClick={() => onSourceClick?.(sourcePart.url)}
        className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-mono hover:bg-accent transition-colors"
      >
        {sourcePart.title ?? sourcePart.url}
      </button>
    );
  }

  return null;
}
