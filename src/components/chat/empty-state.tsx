'use client'

import Link from 'next/link'
import { FolderGit2 } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <FolderGit2 className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold">No repositories indexed</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Index a repository to start asking questions about your code.
      </p>
      <Link href="/repositories" className={buttonVariants({ variant: 'default' })}>
        Go to Repositories
      </Link>
    </div>
  )
}
