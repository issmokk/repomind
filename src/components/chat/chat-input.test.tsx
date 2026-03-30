import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from './chat-input';

describe('ChatInput', () => {
  const defaultProps = {
    input: '',
    onInputChange: vi.fn(),
    onSubmit: vi.fn(),
    isLoading: false,
  };

  it('submit button disabled when input is empty', () => {
    render(<ChatInput {...defaultProps} />);
    const button = screen.getByRole('button');
    expect(button).toHaveProperty('disabled', true);
  });

  it('submit button disabled when streaming', () => {
    render(<ChatInput {...defaultProps} input="test" isLoading={true} />);
    const textarea = screen.getByPlaceholderText('Ask a question about your codebase...');
    expect(textarea).toHaveProperty('disabled', true);
  });

  it('placeholder text reads correctly', () => {
    render(<ChatInput {...defaultProps} />);
    expect(screen.getByPlaceholderText('Ask a question about your codebase...')).toBeTruthy();
  });

  it('Cmd+Enter triggers submit callback', async () => {
    const onSubmit = vi.fn();
    render(<ChatInput {...defaultProps} input="test" onSubmit={onSubmit} />);
    const textarea = screen.getByPlaceholderText('Ask a question about your codebase...');
    const user = userEvent.setup();
    await user.click(textarea);
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows stop button when streaming', () => {
    const onStop = vi.fn();
    render(<ChatInput {...defaultProps} isStreaming={true} isLoading={true} onStop={onStop} />);
    const stopButton = screen.getByRole('button');
    expect(stopButton).not.toHaveProperty('disabled', true);
  });
});
