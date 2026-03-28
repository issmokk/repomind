import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Chat</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Chat with your indexed codebases using RAG-powered AI. Index a repository first to get
          started.
        </p>
      </div>
    </div>
  );
}
