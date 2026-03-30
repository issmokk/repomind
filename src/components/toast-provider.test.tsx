import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { ToastProvider } from './toast-provider';

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

describe('ToastProvider', () => {
  it('renders without crashing', () => {
    const { container } = render(<ToastProvider />);
    expect(container).toBeTruthy();
  });
});
