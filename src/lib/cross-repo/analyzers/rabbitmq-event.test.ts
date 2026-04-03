// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RabbitMqEventFlowAnalyzer } from './rabbitmq-event'
import type { StorageProvider } from '@/lib/storage/types'
import type { GitHubClient } from '@/lib/github/client'
import type { Repository } from '@/types/repository'

const PUBLISHER_SOURCE = `
class PaymentCompletedPublisher
  include Injectable

  def call(payment)
    publish_event('payment.completed', { payment_id: payment.id })
  end
end
`

const SUBSCRIBER_SOURCE = `
class BookingEventSubscriber
  include Injectable

  subscribe 'payment.completed'

  def handle(event)
    update_booking(event[:payment_id])
  end
end
`

const CONSTANT_EVENT_SOURCE = `
class NotificationPublisher
  EVENT_NAME = 'booking.confirmed'

  def call(booking)
    publish_event(EVENT_NAME, booking.to_h)
  end
end
`

const DYNAMIC_EVENT_SOURCE = `
class DynamicPublisher
  def call(entity, action)
    publish_event("\#{entity.class.name.underscore}.\#{action}", entity.to_h)
  end
end
`

const DOT_PUBLISH_SOURCE = `
class EventBus
  def notify(booking)
    channel.publish('booking.created', booking.to_json)
  end
end
`

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

type FileMap = Record<string, Record<string, string>>

function mockStorageWithFiles(storage: StorageProvider, fileMap: FileMap) {
  vi.mocked(storage.listCachedFilePaths).mockImplementation(async (repoId: string) => {
    const repoFiles = fileMap[repoId]
    return repoFiles ? Object.keys(repoFiles) : []
  })
  vi.mocked(storage.getCachedFile).mockImplementation(async (repoId: string, filePath: string) => {
    const repoFiles = fileMap[repoId]
    if (!repoFiles || !repoFiles[filePath]) return null
    return {
      id: 1, repoId, filePath, content: repoFiles[filePath],
      sha: 'abc', language: 'ruby', sizeBytes: 100, isGenerated: false, fetchedAt: new Date().toISOString(),
    }
  })
}

describe('RabbitMqEventFlowAnalyzer', () => {
  let analyzer: RabbitMqEventFlowAnalyzer
  let storage: StorageProvider
  let githubClient: GitHubClient

  beforeEach(() => {
    analyzer = new RabbitMqEventFlowAnalyzer()
    storage = {
      getCachedFile: vi.fn(),
      listCachedFilePaths: vi.fn().mockResolvedValue([]),
    } as unknown as StorageProvider
    githubClient = {
      getFileContent: vi.fn(),
    } as unknown as GitHubClient
  })

  it('has the correct name', () => {
    expect(analyzer.name).toBe('rabbitmq-event-flow')
  })

  it('detects literal publish_event calls with confidence 1.0', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_payment', fullName: 'org/wt_payment' })
    const fileMap: FileMap = {
      'repo-a': { 'app/publishers/payment_completed.rb': PUBLISHER_SOURCE },
    }
    mockStorageWithFiles(storage, fileMap)

    const edges = await analyzer.analyze([repoA], storage, githubClient)

    const publishEdge = edges.find(e => e.metadata.event_name === 'payment.completed')
    expect(publishEdge).toBeDefined()
    expect(publishEdge!.confidence).toBe(1.0)
    expect(publishEdge!.relationshipType).toBe('event_publish')
  })

  it('detects subscribe patterns with confidence 1.0', async () => {
    const repoB = makeRepo({ id: 'repo-b', name: 'wt_booking', fullName: 'org/wt_booking' })
    const fileMap: FileMap = {
      'repo-b': { 'app/subscribers/booking_event.rb': SUBSCRIBER_SOURCE },
    }
    mockStorageWithFiles(storage, fileMap)

    const edges = await analyzer.analyze([repoB], storage, githubClient)

    const subEdge = edges.find(e => e.metadata.event_name === 'payment.completed')
    expect(subEdge).toBeDefined()
    expect(subEdge!.confidence).toBe(1.0)
    expect(subEdge!.relationshipType).toBe('event_subscribe')
  })

  it('matches publishers to subscribers by event name across repos', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_payment', fullName: 'org/wt_payment' })
    const repoB = makeRepo({ id: 'repo-b', name: 'wt_booking', fullName: 'org/wt_booking' })
    const fileMap: FileMap = {
      'repo-a': { 'app/publishers/payment_completed.rb': PUBLISHER_SOURCE },
      'repo-b': { 'app/subscribers/booking_event.rb': SUBSCRIBER_SOURCE },
    }
    mockStorageWithFiles(storage, fileMap)

    const edges = await analyzer.analyze([repoA, repoB], storage, githubClient)

    const pubEdge = edges.find(e => e.relationshipType === 'event_publish' && e.sourceRepoId === 'repo-a')
    const subEdge = edges.find(e => e.relationshipType === 'event_subscribe' && e.sourceRepoId === 'repo-b')
    expect(pubEdge).toBeDefined()
    expect(subEdge).toBeDefined()
    expect(pubEdge!.metadata.event_name).toBe('payment.completed')
    expect(subEdge!.metadata.event_name).toBe('payment.completed')
  })

  it('resolves constant-based event names with confidence 0.7', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_notification', fullName: 'org/wt_notification' })
    const fileMap: FileMap = {
      'repo-a': { 'app/publishers/notification.rb': CONSTANT_EVENT_SOURCE },
    }
    mockStorageWithFiles(storage, fileMap)

    const edges = await analyzer.analyze([repoA], storage, githubClient)

    const constEdge = edges.find(e => e.metadata.event_name === 'booking.confirmed')
    expect(constEdge).toBeDefined()
    expect(constEdge!.confidence).toBe(0.7)
  })

  it('handles dynamic/interpolated event names with confidence 0.3', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_events', fullName: 'org/wt_events' })
    const fileMap: FileMap = {
      'repo-a': { 'app/publishers/dynamic.rb': DYNAMIC_EVENT_SOURCE },
    }
    mockStorageWithFiles(storage, fileMap)

    const edges = await analyzer.analyze([repoA], storage, githubClient)

    expect(edges.length).toBeGreaterThanOrEqual(1)
    const dynamicEdge = edges[0]
    expect(dynamicEdge.confidence).toBe(0.3)
    expect(dynamicEdge.metadata.is_dynamic).toBe(true)
  })

  it('detects .publish() pattern', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_events', fullName: 'org/wt_events' })
    const fileMap: FileMap = {
      'repo-a': { 'app/bus/event_bus.rb': DOT_PUBLISH_SOURCE },
    }
    mockStorageWithFiles(storage, fileMap)

    const edges = await analyzer.analyze([repoA], storage, githubClient)

    const pubEdge = edges.find(e => e.metadata.event_name === 'booking.created')
    expect(pubEdge).toBeDefined()
    expect(pubEdge!.confidence).toBe(1.0)
  })

  it('returns empty array when no patterns match', async () => {
    const repoA = makeRepo({ id: 'repo-a', name: 'wt_plain', fullName: 'org/wt_plain' })
    const noEventSource = `
class PlainService
  def call
    puts "hello"
  end
end
`
    const fileMap: FileMap = {
      'repo-a': { 'app/services/plain.rb': noEventSource },
    }
    mockStorageWithFiles(storage, fileMap)

    const edges = await analyzer.analyze([repoA], storage, githubClient)

    expect(edges).toEqual([])
  })
})
