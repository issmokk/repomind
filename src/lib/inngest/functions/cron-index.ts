import { inngest } from '../client'
import { SupabaseStorageProvider } from '@/lib/storage/supabase'

const INTERVAL_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}

export const cronIndexFunction = inngest.createFunction(
  {
    id: 'cron-index-check',
    name: 'Cron Index Check',
    retries: 2,
    triggers: [{ cron: 'TZ=UTC 0 * * * *' }],
  },
  async ({ step }) => {
    const repos = await step.run('find-due-repos', async () => {
      const storage = new SupabaseStorageProvider()
      const cronRepos = await storage.getCronRepositories()
      const now = Date.now()

      return cronRepos.filter(({ repo, settings }) => {
        if (!repo.lastIndexedCommit) return true

        const intervalMs = INTERVAL_MS[settings.cronInterval] ?? INTERVAL_MS['24h']
        const lastIndexed = new Date(repo.updatedAt).getTime()
        return now - lastIndexed >= intervalMs
      })
    })

    if (repos.length === 0) return { triggered: 0 }

    let triggered = 0

    for (const { repo } of repos) {
      await step.run(`trigger-${repo.id}`, async () => {
        const storage = new SupabaseStorageProvider()

        const activeJob = await storage.getActiveJob(repo.id)
        if (activeJob) return

        const job = await storage.createJob({
          repoId: repo.id,
          triggerType: 'cron',
          toCommit: repo.defaultBranch ?? 'main',
          fromCommit: repo.lastIndexedCommit,
        })

        await inngest.send({
          name: 'repo/index',
          data: {
            repoId: repo.id,
            jobId: job.id,
            triggerType: 'cron' as const,
            indexMode: 'update',
          },
        })

        triggered++
      })
    }

    return { triggered, checked: repos.length }
  },
)
