export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <p className="text-muted-foreground font-mono text-sm">
        Conversation: {conversationId}
      </p>
    </div>
  );
}
