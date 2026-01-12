import { nanoid } from 'nanoid';
import { chatsModel } from '@/model/chats';
import type { Message as MessageType, Chat as ChatType } from '@/model/chats';
import { userModel } from '@/model/user';
import { MESSAGES_PAGE_SIZE } from '@/const/limits';
import { Subscribable } from './subscribable';
import { Message, SERVICE_TYPES } from './message';
import type { UserId, WatcherId, SubscribeAction, CallbackForAction, WildcardSubscribeType, ChatEntity, WatcherMeta } from './types';

export const CHAT_SUBSCRIBE_TYPES = {
  NEW_MESSAGES: 'NEW_MESSAGES',
  CHAT_UPDATED: 'CHAT_UPDATED',
  CLOSE_WATCHERS_BY_META_KEY: 'CLOSE_WATCHERS_BY_META_KEY',
} as const;
type ChatSubscribeTypes = typeof CHAT_SUBSCRIBE_TYPES;

type CommonPayload = { chatId: ChatType['id'] };
export type ChatNewMessagesSubscribeAction = SubscribeAction<
  ChatSubscribeTypes['NEW_MESSAGES'],
  CommonPayload & { messages: MessageType[] }
>;
export type ChatChatUpdatedSubscribeAction = SubscribeAction<
  ChatSubscribeTypes['CHAT_UPDATED'],
  CommonPayload & { onlyForJoined: boolean }
>;
export type ChatCloseWatchersByMetaKeyAction = SubscribeAction<
  ChatSubscribeTypes['CLOSE_WATCHERS_BY_META_KEY'],
  CommonPayload & { key: keyof WatcherMeta; value: string }
>;
export type ChatSubscribeActions = ChatNewMessagesSubscribeAction | ChatChatUpdatedSubscribeAction | ChatCloseWatchersByMetaKeyAction;

export class Chat extends Subscribable<ChatSubscribeActions, WatcherMeta> {
  id: string;

  constructor(id?: string) {
    super();

    this.id = id ?? nanoid();
  }

  static async createChat(name: string, creatorId?: UserId): Promise<Chat | null> {
    const chatWithName = await chatsModel.checkChatName(name);

    if (!chatWithName) {
      const newChat = new Chat();
      let messages: MessageType[] = [];

      if (creatorId) {
        const user = await userModel.getUser(creatorId);
        messages = [new Message(null, creatorId, user?.username || '', SERVICE_TYPES.CHAT_CREATED).setIndex(0)];
      }

      await chatsModel.createChat({
        id: newChat.id,
        creatorId: creatorId,
        name: name,
        joinedUsers: [],
        messages,
      });

      return newChat;
    }

    return null;
  }
  static restoreChat(id: string) {
    return new Chat(id);
  }

  async subscribeIfJoined<SubscribeType extends ChatSubscribeActions['type'] | WildcardSubscribeType>(
    type: SubscribeType,
    callback: CallbackForAction<ChatSubscribeActions, SubscribeType>,
    meta: Required<WatcherMeta>,
    onUnsubscribed?: () => void,
  ): Promise<WatcherId | null> {
    if (await this.isJoined(meta.userId)) {
      return super.subscribe(type, callback, meta, onUnsubscribed);
    }

    return null;
  }

  async join(userId: UserId): Promise<boolean> {
    if (await this.isJoined(userId)) {
      return false;
    }

    await chatsModel.addUserToChat(this.id, userId);

    this._broadcast(CHAT_SUBSCRIBE_TYPES.CHAT_UPDATED, { chatId: this.id, onlyForJoined: true });
    const user = await userModel.getUser(userId);
    const message = new Message(null, userId, user?.username || '', SERVICE_TYPES.CHAT_JOINED);
    await this._addMessage(message);

    return true;
  }

  async publish(text: string, fromId: UserId): Promise<MessageType | null> {
    if (await this.isJoined(fromId)) {
      const user = await userModel.getUser(fromId);
      const message = new Message(text, fromId, user?.username || '');
      return this._addMessage(message);
    }

    return null;
  }

  async quit(userId: UserId): Promise<number | null> {
    if (await this.isJoined(userId)) {
      await chatsModel.removeUserFromChat(this.id, userId);

      this.closeWatchersByMetaKey('userId', userId);

      this._broadcast(CHAT_SUBSCRIBE_TYPES.CHAT_UPDATED, { chatId: this.id, onlyForJoined: true });
      const user = await userModel.getUser(userId);
      const message = new Message(null, userId, user?.username || '', SERVICE_TYPES.CHAT_LEFT);
      await this._addMessage(message);

      return chatsModel.getChatJoinedUsersCount(this.id);
    }

    return null;
  }

  async isJoined(userId: UserId): Promise<boolean> {
    return chatsModel.isJoined(this.id, userId);
  }

  async getMessages(userId: UserId, ...args: Parameters<Chat['_getMessages']>): Promise<MessageType[] | null> {
    if (await this.isJoined(userId)) {
      return this._getMessages(...args);
    }

    return null;
  }

  async getChatEntity(userId?: UserId | null, withMessages = true): Promise<ChatEntity> {
    const isJoined = !!userId && (await this.isJoined(userId));
    const chat = await chatsModel.getChatInfo(this.id);

    return {
      id: this.id,
      name: chat?.name || '',
      joinedCount: isJoined ? chat?.joinedCount || 0 : null,
      messages: isJoined && withMessages ? await this._getMessages() : [],
    };
  }

  async _addMessage(message: Message): Promise<MessageType> {
    const lastMessage = await chatsModel.getLastMessage(this.id);
    const index = lastMessage ? lastMessage.index + 1 : 0;
    message.setIndex(index);
    await chatsModel.addMessage(this.id, message);

    this._broadcast(CHAT_SUBSCRIBE_TYPES.NEW_MESSAGES, { chatId: this.id, messages: [message] });

    return message;
  }

  async _getMessages(lastMessageId?: MessageType['id'], direction: 1 | -1 = 1, pageSize = MESSAGES_PAGE_SIZE): Promise<MessageType[]> {
    if (lastMessageId) {
      const message = await chatsModel.getMessageById(this.id, lastMessageId);

      if (!message) {
        return [];
      }

      const lastMessageIndex = message.index;

      if (Math.sign(direction) === 1) {
        return await chatsModel.getMessagesSlice(this.id, [lastMessageIndex + 1, pageSize]);
      } else {
        const startIndex = Math.max(0, lastMessageIndex - pageSize);
        const count = lastMessageIndex - startIndex;

        if (count === 0) {
          return [];
        }

        return await chatsModel.getMessagesSlice(this.id, [startIndex, count]);
      }
    }

    return await chatsModel.getMessagesSlice(this.id, -pageSize);
  }

  closeWatchersByMetaKey(key: keyof WatcherMeta, value: string): void {
    this._broadcast(CHAT_SUBSCRIBE_TYPES.CLOSE_WATCHERS_BY_META_KEY, { chatId: this.id, key, value });

    return super.closeWatchersByMetaKey(key, value);
  }

  async _closeChat(): Promise<void> {
    await chatsModel.deleteChat(this.id);
    this._closeAllWatchers();
  }
}
