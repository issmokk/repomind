import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackButtons } from './feedback-buttons';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('FeedbackButtons', () => {
  it('clicking thumbs up calls feedback API', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    render(<FeedbackButtons messageId="msg-1" />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Thumbs up'));
    expect(fetchSpy).toHaveBeenCalledWith('/api/chat/feedback', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ messageId: 'msg-1', rating: 'up' }),
    }));
    fetchSpy.mockRestore();
  });

  it('clicking thumbs down calls feedback API', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    render(<FeedbackButtons messageId="msg-2" />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Thumbs down'));
    expect(fetchSpy).toHaveBeenCalledWith('/api/chat/feedback', expect.objectContaining({
      body: JSON.stringify({ messageId: 'msg-2', rating: 'down' }),
    }));
    fetchSpy.mockRestore();
  });

  it('shows filled icon for selected rating', () => {
    const { container } = render(<FeedbackButtons messageId="msg-3" initialRating="up" />);
    const thumbsUpBtn = container.querySelector('[aria-label="Thumbs up"]');
    const svg = thumbsUpBtn?.querySelector('svg');
    const svgClass = svg?.getAttribute('class') ?? '';
    expect(svgClass).toContain('fill-current');
  });
});
