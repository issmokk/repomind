import { describe, it, expectTypeOf } from 'vitest'
import type { RepoLink, RepoLinkMembership } from '../cross-repo'
import type { GraphEdge } from '../graph'
import type { Repository } from '../repository'

describe('cross-repo types', () => {
  it('RepoLink has expected shape', () => {
    expectTypeOf<RepoLink>().toHaveProperty('id')
    expectTypeOf<RepoLink>().toHaveProperty('orgId')
    expectTypeOf<RepoLink>().toHaveProperty('name')
  })

  it('RepoLinkMembership references link and repo', () => {
    expectTypeOf<RepoLinkMembership>().toHaveProperty('linkId')
    expectTypeOf<RepoLinkMembership>().toHaveProperty('repoId')
  })

  it('GraphEdge includes optional targetRepoId', () => {
    expectTypeOf<GraphEdge>().toHaveProperty('targetRepoId')
  })

  it('Repository includes optional githubAppInstallationId', () => {
    expectTypeOf<Repository>().toHaveProperty('githubAppInstallationId')
  })
})
