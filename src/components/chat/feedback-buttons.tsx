'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { toast } from 'sonner';

type Rating = 'up' | 'down' | null;

interface Props {
  messageId: string;
  initialRating?: Rating;
}

export function FeedbackButtons({ messageId, initialRating = null }: Props) {
  const [rating, setRating] = useState<Rating>(initialRating);

  async function handleRate(value: 'up' | 'down') {
    const prev = rating;
    setRating(value);
    try {
      const res = await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, rating: value }),
      });
      if (!res.ok) throw new Error('Failed to save feedback');
    } catch {
      setRating(prev);
      toast.error('Failed to save feedback');
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleRate('up')}
        className="p-1 rounded hover:bg-accent transition-colors"
        aria-label="Thumbs up"
      >
        <ThumbsUp
          className={`h-3.5 w-3.5 ${rating === 'up' ? 'fill-current text-foreground' : 'text-muted-foreground'}`}
        />
      </button>
      <button
        onClick={() => handleRate('down')}
        className="p-1 rounded hover:bg-accent transition-colors"
        aria-label="Thumbs down"
      >
        <ThumbsDown
          className={`h-3.5 w-3.5 ${rating === 'down' ? 'fill-current text-foreground' : 'text-muted-foreground'}`}
        />
      </button>
    </div>
  );
}
