import type { JobLogEntry } from '@/types/indexing'

type CreateLogEntryOptions = {
  message: string
  level?: JobLogEntry['level']
  step?: string
  batch_number?: number
  file?: string
  duration_ms?: number
  error?: string
}

export function createLogEntry(options: CreateLogEntryOptions): JobLogEntry {
  const entry: JobLogEntry = {
    timestamp: new Date().toISOString(),
    level: options.level ?? 'info',
    message: options.message,
  }
  if (options.step !== undefined) entry.step = options.step
  if (options.batch_number !== undefined) entry.batch_number = options.batch_number
  if (options.file !== undefined) entry.file = options.file
  if (options.duration_ms !== undefined) entry.duration_ms = options.duration_ms
  if (options.error !== undefined) entry.error = options.error
  return entry
}

export function appendLogEntries(
  existing: JobLogEntry[] | null | undefined,
  newEntries: JobLogEntry[]
): JobLogEntry[] {
  return [...(existing ?? []), ...newEntries]
}
