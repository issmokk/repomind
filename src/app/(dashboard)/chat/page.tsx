import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabaseStorageProvider } from '@/lib/storage/supabase'
import { ChatInterface } from '@/components/chat/chat-interface'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const storage = new SupabaseStorageProvider()
  const repos = await storage.getRepositories(supabase)

  const repoProps = repos.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.fullName,
  }))

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ChatInterface repos={repoProps} />
    </div>
  )
}
