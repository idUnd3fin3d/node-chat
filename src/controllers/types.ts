import type { Message } from '@/model/chats';
import type { ChatEntity } from '@/services/chat';

export type { UserSettings, User } from '@/model/user';
export type { Message } from '@/model/chats';

export type { ChatEntity as Chat } from '@/services/chat';

export interface SubscribedChatPayload {
  chatId: ChatEntity['id'];
  messages: Message[];
}

export interface WatchChatsPayload {
  newChats: ChatEntity[];
  deletedChatsIds: ChatEntity['id'][];
  updatedChats: ChatEntity[];
}

export type { AuthData, UserProfile } from '@/services/user';
export type { TokenPair } from '@/services/token';
