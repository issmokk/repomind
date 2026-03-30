'use client';

import { usePathname } from 'next/navigation';

export interface BreadcrumbItem {
  label: string;
  href: string;
}

function toTitleCase(segment: string): string {
  return segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [];

  return segments.map((segment, index) => ({
    label: toTitleCase(segment),
    href: '/' + segments.slice(0, index + 1).join('/'),
  }));
}
