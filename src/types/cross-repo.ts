export type RepoLink = {
  id: string
  orgId: string
  name: string
  createdAt: string
  updatedAt: string
}

export type NewRepoLink = Pick<RepoLink, 'orgId' | 'name'>

export type RepoLinkMembership = {
  id: string
  linkId: string
  repoId: string
  createdAt: string
}

export type NewRepoLinkMembership = Pick<RepoLinkMembership, 'linkId' | 'repoId'>

export type CrossRepoRelationshipType =
  | 'gem_dependency'
  | 'npm_dependency'
  | 'event_publish'
  | 'event_subscribe'
