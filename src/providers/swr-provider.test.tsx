import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SWRProvider } from './swr-provider';

describe('SWRProvider', () => {
  it('renders children without crashing', () => {
    render(
      <SWRProvider>
        <div>Child content</div>
      </SWRProvider>,
    );
    expect(screen.getByText('Child content')).toBeTruthy();
  });
});
