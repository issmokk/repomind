export type { StorageProvider } from './types'
export { SupabaseStorageProvider } from './supabase'

import { SupabaseStorageProvider } from './supabase'
import type { StorageProvider } from './types'

export function createStorageProvider(type: 'supabase'): StorageProvider
export function createStorageProvider(type: string): StorageProvider {
  switch (type) {
    case 'supabase':
      return new SupabaseStorageProvider()
    default:
      throw new Error(`Unsupported storage provider: "${type}". Supported: supabase`)
  }
}
