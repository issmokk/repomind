import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { indexRepoFunction } from '@/lib/inngest/functions/index-repo'
import { debugFetchFunction } from '@/lib/inngest/functions/debug-fetch'
import { cronIndexFunction } from '@/lib/inngest/functions/cron-index'

const handler = serve({
  client: inngest,
  functions: [indexRepoFunction, debugFetchFunction, cronIndexFunction],
})

export const { GET, POST, PUT } = handler
