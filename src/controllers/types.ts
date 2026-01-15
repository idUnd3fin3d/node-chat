import type { Message } from '@/model/chats';

export type { UserSettings, User } from '@/model/user';
export type { Message } from '@/model/chats';

export type { ChatEntity as Chat } from '@/services/chat';

export interface SubscribedChatPayload {
  chatId: Chat['id'];
  messages: Message[];
}

export interface WatchChatsPayload {
  newChats: Chat[];
  deletedChatsIds: Chat['id'][];
  updatedChats: Chat[];
}

export type { AuthData, UserProfile } from '@/services/user';
export type { TokenPair } from '@/services/token';
