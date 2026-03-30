import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBreadcrumbs } from './use-breadcrumbs';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from 'next/navigation';
const mockUsePathname = vi.mocked(usePathname);

describe('useBreadcrumbs', () => {
  it('generates correct chain from /repositories', () => {
    mockUsePathname.mockReturnValue('/repositories');
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current).toEqual([{ label: 'Repositories', href: '/repositories' }]);
  });

  it('generates chain from /repositories/abc-123', () => {
    mockUsePathname.mockReturnValue('/repositories/abc-123');
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current).toEqual([
      { label: 'Repositories', href: '/repositories' },
      { label: 'Abc 123', href: '/repositories/abc-123' },
    ]);
  });

  it('handles root path / by returning empty array', () => {
    mockUsePathname.mockReturnValue('/');
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current).toEqual([]);
  });

  it('handles /chat/some-uuid', () => {
    mockUsePathname.mockReturnValue('/chat/some-uuid');
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current).toEqual([
      { label: 'Chat', href: '/chat' },
      { label: 'Some Uuid', href: '/chat/some-uuid' },
    ]);
  });

  it('handles /knowledge-graph with hyphenated segment', () => {
    mockUsePathname.mockReturnValue('/knowledge-graph');
    const { result } = renderHook(() => useBreadcrumbs());
    expect(result.current).toEqual([{ label: 'Knowledge Graph', href: '/knowledge-graph' }]);
  });
});
