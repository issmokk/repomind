import { Inngest, eventType } from 'inngest'

export type IndexMode = 'update' | 'full'

export type RepoIndexEventData = {
  repoId: string
  jobId: string
  triggerType: 'manual' | 'webhook' | 'install'
  indexMode?: IndexMode
  changedFiles?: string[]
  retryFiles?: string[]
}

const repoIndexEvent = eventType('repo/index')

export const inngest = new Inngest({
  id: 'repomind',
  schemas: [repoIndexEvent],
})
