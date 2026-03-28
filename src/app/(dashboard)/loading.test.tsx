import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Loading from './loading';

describe('Loading', () => {
  it('renders without crashing', () => {
    const { container } = render(<Loading />);
    expect(container.firstChild).toBeTruthy();
  });
});
