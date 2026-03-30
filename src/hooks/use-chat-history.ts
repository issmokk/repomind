'use client';

import { useState, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import type { ConversationGroup } from '@/components/chat/conversation-history';

interface ChatHistoryMessage {
  id: string;
  question: string;
  createdAt: string;
}

interface HistoryResponse {
  messages: ChatHistoryMessage[];
  total: number;
}

function groupByDate(messages: ChatHistoryMessage[]): ConversationGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const monthAgo = new Date(today.getTime() - 30 * 86400000);

  const groups: Record<string, ChatHistoryMessage[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    'Previous 30 Days': [],
    Older: [],
  };

  for (const msg of messages) {
    const date = new Date(msg.createdAt);
    if (date >= today) groups['Today'].push(msg);
    else if (date >= yesterday) groups['Yesterday'].push(msg);
    else if (date >= weekAgo) groups['Previous 7 Days'].push(msg);
    else if (date >= monthAgo) groups['Previous 30 Days'].push(msg);
    else groups['Older'].push(msg);
  }

  return Object.entries(groups)
    .filter(([, msgs]) => msgs.length > 0)
    .map(([label, conversations]) => ({ label, conversations }));
}

const LIMIT = 20;

export function useChatHistory(searchQuery?: string) {
  const [page, setPage] = useState(1);

  const key = `/api/chat/history?page=${page}&limit=${LIMIT}&q=${encodeURIComponent(searchQuery ?? '')}`;

  const { data, error, isLoading } = useSWR<HistoryResponse>(key);

  const messages = useMemo(() => data?.messages ?? [], [data?.messages]);
  const hasMore = messages.length === LIMIT;

  const groups = useMemo(() => groupByDate(messages), [messages]);

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  return { groups, isLoading, error, loadMore, hasMore };
}
