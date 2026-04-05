import { NextResponse } from 'next/server'
import { getAuthContext } from '../_helpers'
import { inngest } from '@/lib/inngest/client'
import { SupabaseStorageProvider } from '@/lib/storage/supabase'

export const runtime = 'nodejs'

export async function POST() {
  const auth = await getAuthContext()
  if (auth instanceof NextResponse) return auth

  const storage = new SupabaseStorageProvider()
  const repos = await storage.getRepositories(auth.supabase)

  if (repos.length === 0) {
    return NextResponse.json({ triggered: 0 })
  }

  const results: Array<{ repoId: string; jobId: string }> = []
  const errors: Array<{ repoId: string; error: string }> = []

  for (const repo of repos) {
    const activeJob = await storage.getActiveJob(repo.id)
    if (activeJob) {
      errors.push({ repoId: repo.id, error: 'Indexing already in progress' })
      continue
    }

    try {
      const job = await storage.createJob({
        repoId: repo.id,
        triggerType: 'manual',
        toCommit: repo.defaultBranch ?? 'main',
        fromCommit: repo.lastIndexedCommit,
      })

      await inngest.send({
        name: 'repo/index',
        data: {
          repoId: repo.id,
          jobId: job.id,
          triggerType: 'manual',
          indexMode: 'full',
        },
      })

      results.push({ repoId: repo.id, jobId: job.id })
    } catch (err) {
      errors.push({ repoId: repo.id, error: (err as Error).message })
    }
  }

  return NextResponse.json({
    triggered: results.length,
    skipped: errors.length,
    results,
    errors,
  })
}
