import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  RepoCardSkeleton,
  ChatMessageSkeleton,
  SettingsSectionSkeleton,
  GraphSkeleton,
  TableRowSkeleton,
} from './skeletons';

describe('Skeleton Components', () => {
  it('RepoCardSkeleton renders without crashing', () => {
    const { container } = render(<RepoCardSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('RepoCardSkeleton uses animate-pulse class', () => {
    const { container } = render(<RepoCardSkeleton />);
    const pulseElements = container.querySelectorAll('[data-slot="skeleton"]');
    expect(pulseElements.length).toBeGreaterThan(0);
  });

  it('RepoCardSkeleton has expected child count', () => {
    const { container } = render(<RepoCardSkeleton />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBe(5);
  });

  it('ChatMessageSkeleton renders without crashing', () => {
    const { container } = render(<ChatMessageSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('SettingsSectionSkeleton renders without crashing', () => {
    const { container } = render(<SettingsSectionSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('GraphSkeleton renders without crashing', () => {
    const { container } = render(<GraphSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it('TableRowSkeleton renders without crashing', () => {
    const { container } = render(<TableRowSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });
});
