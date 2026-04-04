import { Inngest, eventType } from 'inngest'

export type RepoIndexEventData = {
  repoId: string
  jobId: string
  triggerType: 'manual' | 'webhook' | 'install'
  changedFiles?: string[]
  retryFiles?: string[]
}

const repoIndexEvent = eventType('repo/index')

export const inngest = new Inngest({
  id: 'repomind',
  schemas: [repoIndexEvent],
})
