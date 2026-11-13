import type { ChatSession } from '../types/kova';

export const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'session-default',
    title: 'Новая рабочая сессия',
    updatedAt: 'Сейчас',
    mode: 'act',
    messages: [],
  },
];
