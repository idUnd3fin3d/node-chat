import { chatsModel } from '@/model/chats';
import { MAIN_CHAT_NAME } from '@/const/common';
import { Subscribable } from './subscribable';
import { Chat, CHAT_SUBSCRIBE_TYPES } from './chat';
import type { ChatChatUpdatedSubscribeAction } from './chat';
import type { UserId, SubscribeAction, ChatEntity, WatcherMeta } from './types';

export const MANAGER_SUBSCRIBE_TYPES = {
  CHAT_LIST_UPDATED: 'CHAT_LIST_UPDATED',
  CHAT_UPDATED: 'CHAT_UPDATED',
  CLOSE_WATCHERS_BY_META_KEY: 'CLOSE_WATCHERS_BY_META_KEY',
} as const;
type ManagerSubscribeTypes = typeof MANAGER_SUBSCRIBE_TYPES;

export type ManagerChatListUpdatedSubscribeAction = SubscribeAction<
  ManagerSubscribeTypes['CHAT_LIST_UPDATED'],
  { newChats: ChatEntity[]; deletedChatsIds: ChatEntity['id'][] }
>;
export type ManagerChatUpdatedSubscribeAction = SubscribeAction<
  ManagerSubscribeTypes['CHAT_UPDATED'],
  ChatChatUpdatedSubscribeAction['payload']
>;
export type ManagerCloseWatchersByMetaKeyAction = SubscribeAction<
  ManagerSubscribeTypes['CLOSE_WATCHERS_BY_META_KEY'],
  { key: keyof WatcherMeta; value: string }
>;
export type ManagerSubscribeActions =
  | ManagerChatListUpdatedSubscribeAction
  | ManagerChatUpdatedSubscribeAction
  | ManagerCloseWatchersByMetaKeyAction;

export class Manager extends Subscribable<ManagerSubscribeActions, WatcherMeta> {
  chats: Chat[] = [];

  async initChats() {
    const chats = await chatsModel.getAllChatIds();

    if (await chats.hasNext()) {
      let chat;
      while ((chat = await chats.next())) {
        await this.addChat(Chat.restoreChat(chat.id));
      }
    } else {
      const chat = await Chat.createChat(MAIN_CHAT_NAME);

      if (!chat) {
        throw new Error('cannot create main chat');
      }

      await this.addChat(chat);
    }
  }

  getChat(chatId: Chat['id']): Chat | undefined {
    return this.chats.find(({ id }) => id === chatId);
  }
  async getChatEntities(userId: UserId) {
    return Promise.all(this.chats.map((chat) => chat.getChatEntity(userId)));
  }

  async addChat(chat: Chat, broadcastExtra?: Record<string, unknown>): Promise<void> {
    this.chats.push(chat);
    chat.subscribe(CHAT_SUBSCRIBE_TYPES.CHAT_UPDATED, ({ payload }) => {
      this._broadcast(MANAGER_SUBSCRIBE_TYPES.CHAT_UPDATED, payload);
    });

    this._broadcast(
      MANAGER_SUBSCRIBE_TYPES.CHAT_LIST_UPDATED,
      {
        newChats: [await chat.getChatEntity(null, false)],
        deletedChatsIds: [],
      },
      broadcastExtra,
    );
  }

  async deleteChat(chatId: Chat['id'], broadcastExtra?: Record<string, unknown>): Promise<void> {
    const dbChat = await chatsModel.getChatNameById(chatId);

    if (!dbChat || (dbChat && dbChat.name !== MAIN_CHAT_NAME)) {
      const chat = this.chats.find(({ id }) => id === chatId);

      if (chat) {
        await chat._closeChat();
        this._broadcast(MANAGER_SUBSCRIBE_TYPES.CHAT_LIST_UPDATED, { deletedChatsIds: [chatId], newChats: [] }, broadcastExtra);
        this.chats = this.chats.filter((item) => item !== chat);
      }
    }
  }

  async getUserJoinedChats(userId: UserId): Promise<Chat[]> {
    const chats = [...this.chats];
    const isJoined = await Promise.all(chats.map((chat) => chat.isJoined(userId)));

    return chats.filter((chat, index) => isJoined[index]);
  }

  closeWatchersByMetaKey(key: keyof WatcherMeta, value: string): void {
    this._broadcast(MANAGER_SUBSCRIBE_TYPES.CLOSE_WATCHERS_BY_META_KEY, { key, value });

    return super.closeWatchersByMetaKey(key, value);
  }
}

export const manager = new Manager();
