import { type NextRequest, NextResponse } from 'next/server'
import { getRepoContext } from '../../../_helpers'
import { checkAndMarkStaleJob } from '@/lib/indexer/pipeline'

const POLL_INTERVAL = 2000
const HEARTBEAT_INTERVAL = 15000
const MAX_DURATION = 5 * 60 * 1000

export const maxDuration = 300

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await getRepoContext(id)
  if (ctx instanceof NextResponse) return ctx

  const encoder = new TextEncoder()
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let maxDurationTimer: ReturnType<typeof setTimeout> | null = null
  let lastSerialized = ''
  let sentNoJob = false

  const stream = new ReadableStream({
    start(controller) {
      function sendEvent(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      function sendHeartbeat() {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          cleanup()
        }
      }

      function cleanup() {
        if (pollTimer) clearInterval(pollTimer)
        if (heartbeatTimer) clearInterval(heartbeatTimer)
        if (maxDurationTimer) clearTimeout(maxDurationTimer)
        pollTimer = null
        heartbeatTimer = null
        maxDurationTimer = null
        try {
          controller.close()
        } catch {
          // already closed
        }
      }

      async function poll() {
        try {
          const job = await checkAndMarkStaleJob(id, ctx.storage)

          if (job) {
            sentNoJob = false
            const serialized = JSON.stringify(job)
            if (serialized !== lastSerialized) {
              lastSerialized = serialized
              sendEvent('job-update', job)
            }
          } else {
            const latestJob = await ctx.storage.getLatestJob(id, ctx.supabase)
            if (latestJob && (latestJob.status === 'completed' || latestJob.status === 'failed' || latestJob.status === 'partial')) {
              sendEvent('job-complete', latestJob)
              cleanup()
              return
            }
            if (!sentNoJob) {
              sendEvent('no-job', {})
              sentNoJob = true
            }
          }
        } catch {
          cleanup()
        }
      }

      poll()
      pollTimer = setInterval(poll, POLL_INTERVAL)
      heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)
      maxDurationTimer = setTimeout(cleanup, MAX_DURATION)

      request.signal.addEventListener('abort', cleanup)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
