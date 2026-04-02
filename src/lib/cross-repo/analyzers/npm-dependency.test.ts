// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NpmDependencyAnalyzer } from './npm-dependency'
import type { StorageProvider } from '@/lib/storage/types'
import type { GitHubClient } from '@/lib/github/client'
import type { Repository } from '@/types/repository'

const CHECKOUT_PACKAGE_JSON = JSON.stringify({
  name: '@wetravel-mfe/checkout',
  dependencies: {
    'react': '^18.0.0',
    '@wetravel-mfe/common': '^1.0.0',
    '@wetravel-mfe/payment-sdk': '^2.0.0',
    'lodash': '^4.17.0',
  },
  devDependencies: {
    'vitest': '^1.0.0',
  },
})

const PAYMENT_PACKAGE_JSON = JSON.stringify({
  name: '@wetravel-mfe/payment',
  dependencies: {
    'react': '^18.0.0',
    '@wetravel-mfe/common': '^1.0.0',
    'axios': '^1.0.0',
  },
})

const PLAIN_PACKAGE_JSON = JSON.stringify({
  name: 'plain-app',
  dependencies: {
    'react': '^18.0.0',
    'express': '^4.0.0',
  },
})

function makeRepo(overrides: Partial<Repository>): Repository {
  return {
    id: 'repo-1',
    orgId: 'org-1',
    name: 'test-repo',
    fullName: 'org/test-repo',
    url: 'https://github.com/org/test-repo',
    defaultBranch: 'main',
    lastIndexedCommit: null,
    githubAuthType: 'pat',
    githubAppInstallationId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('NpmDependencyAnalyzer', () => {
  let analyzer: NpmDependencyAnalyzer
  let storage: StorageProvider
  let githubClient: GitHubClient

  beforeEach(() => {
    analyzer = new NpmDependencyAnalyzer()
    storage = {
      getCachedFile: vi.fn(),
    } as unknown as StorageProvider
    githubClient = {
      getFileContent: vi.fn(),
    } as unknown as GitHubClient
  })

  it('has the correct name', () => {
    expect(analyzer.name).toBe('npm-dependency')
  })

  it('detects shared scoped packages across repos', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'checkout_app', fullName: 'org/checkout_app' })
    const repoB = makeRepo({ id: 'repo-b', name: 'payment_app', fullName: 'org/payment_app' })

    vi.mocked(storage.getCachedFile).mockImplementation(async (repoId: string) => {
      const content = repoId === 'repo-a' ? CHECKOUT_PACKAGE_JSON : PAYMENT_PACKAGE_JSON
      return {
        id: 1, repoId, filePath: 'package.json', content,
        sha: 'abc', language: null, sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
      }
    })

    const edges = await analyzer.analyze([repoA, repoB], storage, githubClient)

    const commonEdges = edges.filter(e => e.sourceSymbol === '@wetravel-mfe/common')
    expect(commonEdges.length).toBe(2)
    expect(commonEdges.every(e => e.relationshipType === 'npm_dependency')).toBe(true)
  })

  it('ignores common ecosystem packages (react, lodash)', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'checkout_app', fullName: 'org/checkout_app' })
    const repoB = makeRepo({ id: 'repo-b', name: 'payment_app', fullName: 'org/payment_app' })

    vi.mocked(storage.getCachedFile).mockImplementation(async (repoId: string) => {
      const content = repoId === 'repo-a' ? CHECKOUT_PACKAGE_JSON : PAYMENT_PACKAGE_JSON
      return {
        id: 1, repoId, filePath: 'package.json', content,
        sha: 'abc', language: null, sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
      }
    })

    const edges = await analyzer.analyze([repoA, repoB], storage, githubClient)
    const symbols = edges.map(e => e.sourceSymbol)
    expect(symbols).not.toContain('react')
    expect(symbols).not.toContain('lodash')
    expect(symbols).not.toContain('axios')
  })

  it('scans both dependencies and devDependencies', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'checkout_app', fullName: 'org/checkout_app' })
    vi.mocked(storage.getCachedFile).mockResolvedValueOnce({
      id: 1, repoId: 'repo-a', filePath: 'package.json', content: CHECKOUT_PACKAGE_JSON,
      sha: 'abc', language: null, sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
    })

    const edges = await analyzer.analyze([repoA], storage, githubClient)
    const scopedEdges = edges.filter(e => e.sourceSymbol.startsWith('@wetravel'))
    expect(scopedEdges.length).toBeGreaterThanOrEqual(2)
  })

  it('handles missing package.json gracefully', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'no-pkg', fullName: 'org/no-pkg' })
    vi.mocked(storage.getCachedFile).mockResolvedValueOnce(null)
    vi.mocked(githubClient.getFileContent).mockRejectedValueOnce(new Error('Not Found'))

    const edges = await analyzer.analyze([repoA], storage, githubClient)
    expect(edges).toEqual([])
  })

  it('returns no edges for repos with only plain packages', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'plain', fullName: 'org/plain' })
    vi.mocked(storage.getCachedFile).mockResolvedValueOnce({
      id: 1, repoId: 'repo-a', filePath: 'package.json', content: PLAIN_PACKAGE_JSON,
      sha: 'abc', language: null, sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
    })

    const edges = await analyzer.analyze([repoA], storage, githubClient)
    expect(edges).toEqual([])
  })

  it('includes version and is_dev_dependency in metadata', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'checkout_app', fullName: 'org/checkout_app' })
    vi.mocked(storage.getCachedFile).mockResolvedValueOnce({
      id: 1, repoId: 'repo-a', filePath: 'package.json', content: CHECKOUT_PACKAGE_JSON,
      sha: 'abc', language: null, sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
    })

    const edges = await analyzer.analyze([repoA], storage, githubClient)
    const commonEdge = edges.find(e => e.sourceSymbol === '@wetravel-mfe/common')
    expect(commonEdge).toBeDefined()
    expect(commonEdge!.metadata.version).toBe('^1.0.0')
    expect(commonEdge!.metadata.is_dev_dependency).toBe(false)
  })

  it('accepts custom scope prefixes', async () => {
    const customAnalyzer = new NpmDependencyAnalyzer(['@custom/'])
    const repoA = makeRepo({ id: 'repo-a', name: 'app', fullName: 'org/app' })
    const customPkg = JSON.stringify({
      name: 'app',
      dependencies: { '@custom/utils': '^1.0.0', 'react': '^18.0.0' },
    })

    vi.mocked(storage.getCachedFile).mockResolvedValueOnce({
      id: 1, repoId: 'repo-a', filePath: 'package.json', content: customPkg,
      sha: 'abc', language: null, sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
    })

    const edges = await customAnalyzer.analyze([repoA], storage, githubClient)
    expect(edges.some(e => e.sourceSymbol === '@custom/utils')).toBe(true)
  })
})
