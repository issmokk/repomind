import { serve } from 'inngest/next'
import { inngest } from '@/lib/inngest/client'
import { indexRepoFunction } from '@/lib/inngest/functions/index-repo'

const handler = serve({
  client: inngest,
  functions: [indexRepoFunction],
})

export const { GET, POST, PUT } = handler
