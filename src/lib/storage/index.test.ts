// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({})),
}))

import { createStorageProvider } from './index'
import { SupabaseStorageProvider } from './supabase'

describe('createStorageProvider', () => {
  it('returns SupabaseStorageProvider for "supabase"', () => {
    const provider = createStorageProvider('supabase')
    expect(provider).toBeInstanceOf(SupabaseStorageProvider)
  })

  it('throws for unknown provider', () => {
    expect(() => createStorageProvider('unknown' as 'supabase')).toThrow(
      /Unsupported storage provider: "unknown"/,
    )
  })
})
