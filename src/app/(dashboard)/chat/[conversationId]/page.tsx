import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SupabaseStorageProvider } from '@/lib/storage/supabase';
import { ChatInterface } from '@/components/chat/chat-interface';
import type { UIMessage } from 'ai';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const storage = new SupabaseStorageProvider();
  const repos = await storage.getRepositories(supabase);

  const repoProps = repos.map((r) => ({
    id: r.id,
    name: r.name,
    fullName: r.fullName,
  }));

  const dbMessages = await storage.getMessagesBySession(conversationId, supabase);

  const initialMessages: UIMessage[] = dbMessages.flatMap((msg) => {
    const msgs: UIMessage[] = [];
    if (msg.question) {
      msgs.push({
        id: `${msg.id}-q`,
        role: 'user',
        content: msg.question,
        parts: [{ type: 'text', text: msg.question }],
        createdAt: new Date(msg.createdAt),
      });
    }
    if (msg.answer) {
      msgs.push({
        id: `${msg.id}-a`,
        role: 'assistant',
        content: msg.answer,
        parts: [{ type: 'text', text: msg.answer }],
        createdAt: new Date(msg.createdAt),
      });
    }
    return msgs;
  });

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ChatInterface
        conversationId={conversationId}
        repos={repoProps}
        initialMessages={initialMessages}
      />
    </div>
  );
}
