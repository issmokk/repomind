import type { CrossRepoAnalyzer, CrossRepoEdge } from '../types'
import type { Repository } from '@/types/repository'
import type { StorageProvider } from '@/lib/storage/types'
import type { GitHubClient } from '@/lib/github/client'
import type { CrossRepoRelationshipType } from '@/types/cross-repo'

type EventMatch = {
  repoId: string
  filePath: string
  eventName: string
  confidence: number
  type: 'publish' | 'subscribe'
  pattern: string
  isDynamic: boolean
  unresolvedConstant?: boolean
}

const PUBLISHER_PATTERNS: Array<{ regex: RegExp; confidence: number; label: string }> = [
  { regex: /publish_event\(\s*['"]([^'"]+)['"]/g, confidence: 1.0, label: 'publish_event(literal)' },
  { regex: /\.publish\(\s*['"]([^'"]+)['"]/g, confidence: 1.0, label: '.publish(literal)' },
  { regex: /EventPublisher.*['"]([^'"]+)['"]/g, confidence: 1.0, label: 'EventPublisher' },
  { regex: /channel\.basic_publish.*routing_key.*['"]([^'"]+)['"]/g, confidence: 1.0, label: 'basic_publish' },
]

const SUBSCRIBER_PATTERNS: Array<{ regex: RegExp; confidence: number; label: string }> = [
  { regex: /subscribe\s+['"]([^'"]+)['"]/g, confidence: 1.0, label: 'subscribe(literal)' },
  { regex: /subscribe\(\s*['"]([^'"]+)['"]/g, confidence: 1.0, label: 'subscribe(call)' },
  { regex: /EventSubscriber.*['"]([^'"]+)['"]/g, confidence: 1.0, label: 'EventSubscriber' },
  { regex: /on_event\(\s*['"]([^'"]+)['"]/g, confidence: 1.0, label: 'on_event' },
  { regex: /channel\.queue.*bind.*['"]([^'"]+)['"]/g, confidence: 1.0, label: 'queue.bind' },
]

const CONSTANT_PUBLISH_REGEX = /publish_event\(\s*([A-Z][A-Z_0-9]+)\b/g
const CONSTANT_ASSIGNMENT_REGEX = /([A-Z][A-Z_0-9]+)\s*=\s*['"]([^'"]+)['"]/g
const DYNAMIC_PUBLISH_REGEX = /publish_event\(\s*["']#\{/g

export class RabbitMqEventFlowAnalyzer implements CrossRepoAnalyzer {
  readonly name = 'rabbitmq-event-flow'

  async analyze(
    repos: Repository[],
    storage: StorageProvider,
    _githubClient: GitHubClient,
  ): Promise<CrossRepoEdge[]> {
    const allMatches: EventMatch[] = []

    for (const repo of repos) {
      const filePaths = await storage.listCachedFilePaths(repo.id, 'rb')

      for (const filePath of filePaths) {
        const cached = await storage.getCachedFile(repo.id, filePath)
        if (!cached) continue

        const matches = this.scanFile(repo.id, filePath, cached.content)
        allMatches.push(...matches)
      }
    }

    return this.buildEdges(allMatches)
  }

  private scanFile(repoId: string, filePath: string, content: string): EventMatch[] {
    const matches: EventMatch[] = []
    const constants = this.extractConstants(content)

    for (const pattern of PUBLISHER_PATTERNS) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
      let match
      while ((match = regex.exec(content)) !== null) {
        if (match[1].includes('#{')) continue
        matches.push({
          repoId, filePath,
          eventName: match[1],
          confidence: pattern.confidence,
          type: 'publish',
          pattern: pattern.label,
          isDynamic: false,
        })
      }
    }

    for (const pattern of SUBSCRIBER_PATTERNS) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags)
      let match
      while ((match = regex.exec(content)) !== null) {
        matches.push({
          repoId, filePath,
          eventName: match[1],
          confidence: pattern.confidence,
          type: 'subscribe',
          pattern: pattern.label,
          isDynamic: false,
        })
      }
    }

    const constRegex = new RegExp(CONSTANT_PUBLISH_REGEX.source, CONSTANT_PUBLISH_REGEX.flags)
    let constMatch
    while ((constMatch = constRegex.exec(content)) !== null) {
      const constantName = constMatch[1]
      const resolvedValue = constants.get(constantName)
      if (resolvedValue) {
        matches.push({
          repoId, filePath,
          eventName: resolvedValue,
          confidence: 0.7,
          type: 'publish',
          pattern: 'constant_reference',
          isDynamic: false,
        })
      } else {
        matches.push({
          repoId, filePath,
          eventName: `<unresolved:${constantName}>`,
          confidence: 0.3,
          type: 'publish',
          pattern: 'unresolved_constant',
          isDynamic: false,
          unresolvedConstant: true,
        })
      }
    }

    const dynRegex = new RegExp(DYNAMIC_PUBLISH_REGEX.source, DYNAMIC_PUBLISH_REGEX.flags)
    if (dynRegex.test(content)) {
      matches.push({
        repoId, filePath,
        eventName: '<dynamic>',
        confidence: 0.3,
        type: 'publish',
        pattern: 'dynamic_interpolation',
        isDynamic: true,
      })
    }

    return matches
  }

  private extractConstants(content: string): Map<string, string> {
    const constants = new Map<string, string>()
    const regex = new RegExp(CONSTANT_ASSIGNMENT_REGEX.source, CONSTANT_ASSIGNMENT_REGEX.flags)
    let match
    while ((match = regex.exec(content)) !== null) {
      constants.set(match[1], match[2])
    }
    return constants
  }

  private deduplicateMatches(matches: EventMatch[]): EventMatch[] {
    const seen = new Map<string, EventMatch>()
    for (const m of matches) {
      const key = `${m.repoId}:${m.filePath}:${m.eventName}:${m.type}`
      const existing = seen.get(key)
      if (!existing || m.confidence > existing.confidence) {
        seen.set(key, m)
      }
    }
    return Array.from(seen.values())
  }

  private buildEdges(matches: EventMatch[]): CrossRepoEdge[] {
    const deduplicated = this.deduplicateMatches(matches)
    const edges: CrossRepoEdge[] = []

    for (const m of deduplicated) {
      const relType: CrossRepoRelationshipType = m.type === 'publish' ? 'event_publish' : 'event_subscribe'

      edges.push({
        sourceRepoId: m.repoId,
        sourceFile: m.filePath,
        sourceSymbol: m.filePath.split('/').pop()?.replace('.rb', '') ?? m.filePath,
        targetRepoId: m.repoId,
        targetFile: null,
        targetSymbol: m.eventName,
        relationshipType: relType,
        metadata: {
          event_name: m.eventName,
          source_pattern: m.pattern,
          is_dynamic: m.isDynamic,
          ...(m.unresolvedConstant && { unresolved_constant: true }),
        },
        confidence: m.confidence,
      })
    }

    return edges
  }
}
