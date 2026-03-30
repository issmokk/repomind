import { redirect } from 'next/navigation';

export default function ChatPage() {
  redirect(`/chat/${crypto.randomUUID()}`);
}
