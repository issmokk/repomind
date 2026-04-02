// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLogEntry, appendLogEntries } from './job-logger'
import type { JobLogEntry } from '@/types/indexing'

describe('job-logger', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-01T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a log entry with correct defaults', () => {
    const entry = createLogEntry({ message: 'test message' })
    expect(entry).toEqual({
      timestamp: '2026-04-01T12:00:00.000Z',
      level: 'info',
      message: 'test message',
    })
  })

  it('round-trips through JSON serialization', () => {
    const entry = createLogEntry({
      message: 'full entry',
      level: 'warn',
      step: 'process-batch-3',
      batch_number: 3,
      file: 'src/index.ts',
      duration_ms: 150,
      error: 'something went wrong',
    })
    const roundTripped = JSON.parse(JSON.stringify(entry)) as JobLogEntry
    expect(roundTripped).toEqual(entry)
    expect(typeof roundTripped.timestamp).toBe('string')
    expect(typeof roundTripped.duration_ms).toBe('number')
    expect(typeof roundTripped.batch_number).toBe('number')
  })

  it('captures step name and batch number', () => {
    const entry = createLogEntry({
      message: 'processing batch',
      step: 'initialize',
      batch_number: 1,
    })
    expect(entry.timestamp).toBe('2026-04-01T12:00:00.000Z')
    expect(entry.step).toBe('initialize')
    expect(entry.batch_number).toBe(1)
    expect(entry.level).toBe('info')
  })

  it('creates error entry with error field', () => {
    const entry = createLogEntry({
      message: 'parsing failed',
      level: 'error',
      error: 'SyntaxError: unexpected token',
    })
    expect(entry.level).toBe('error')
    expect(entry.error).toBe('SyntaxError: unexpected token')
  })

  it('includes file and duration_ms for file processing', () => {
    const entry = createLogEntry({
      message: 'processed file',
      file: 'src/components/App.tsx',
      duration_ms: 42,
    })
    expect(entry.file).toBe('src/components/App.tsx')
    expect(entry.duration_ms).toBe(42)
    expect(typeof entry.file).toBe('string')
    expect(typeof entry.duration_ms).toBe('number')
  })

  it('appendLogEntries merges new entries into existing array', () => {
    const existing: JobLogEntry[] = [
      { timestamp: '2026-04-01T11:00:00.000Z', level: 'info', message: 'started' },
    ]
    const newEntries: JobLogEntry[] = [
      createLogEntry({ message: 'step 1' }),
      createLogEntry({ message: 'step 2' }),
    ]
    const result = appendLogEntries(existing, newEntries)
    expect(result).toHaveLength(3)
    expect(result[0].message).toBe('started')
    expect(result[1].message).toBe('step 1')
    expect(result[2].message).toBe('step 2')
  })

  it('appendLogEntries handles empty existing array', () => {
    const newEntries: JobLogEntry[] = [createLogEntry({ message: 'first' })]
    const result = appendLogEntries([], newEntries)
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe('first')
  })

  it('appendLogEntries handles null existing array', () => {
    const newEntries: JobLogEntry[] = [createLogEntry({ message: 'first' })]
    const result = appendLogEntries(null, newEntries)
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe('first')
  })
})
