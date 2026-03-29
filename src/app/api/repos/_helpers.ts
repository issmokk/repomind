import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SupabaseStorageProvider } from '@/lib/storage/supabase'
import type { StorageProvider } from '@/lib/storage/types'
import type { Repository } from '@/types/repository'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AuthContext = {
  userId: string
  orgId: string
  supabase: SupabaseClient
  storage: StorageProvider
}

export type RepoContext = AuthContext & {
  repo: Repository
}

export async function getAuthContext(): Promise<AuthContext | NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const orgId = user.app_metadata?.org_id ?? user.id
  const storage = new SupabaseStorageProvider()

  return { userId: user.id, orgId, supabase, storage }
}

export async function getRepoContext(repoId: string): Promise<RepoContext | NextResponse> {
  const authResult = await getAuthContext()
  if (authResult instanceof NextResponse) return authResult

  const { supabase, storage } = authResult
  const repo = await storage.getRepository(repoId, supabase)

  if (!repo) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
  }

  return { ...authResult, repo }
}
