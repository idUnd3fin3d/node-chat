import { createClient } from 'redis';
import { nanoid } from 'nanoid';
import { Chat } from '@/services/chat';
import type { ManagerSubscribeActions, ChatSubscribeActions, Manager } from '@/services/chat';
import { isObject } from '@/utils/common';
import type { SyncData, SyncPayload } from './types';

function assertIsSyncData(data: unknown): asserts data is SyncData {
  if (isObject(data) && typeof data.instanceId === 'string' && typeof data.source === 'string' && typeof isObject(data.action)) {
    return;
  }

  throw new Error('not SyncData');
}

export class ChatSyncService {
  instanceId: string;
  _channelName: string;
  _publisher: ReturnType<typeof createClient>;
  _subscriber: ReturnType<typeof createClient>;
  _chatsManager: Manager;

  constructor(chatsManager: Manager, url: string, channelName: string) {
    this.instanceId = nanoid();
    this._channelName = channelName;
    this._chatsManager = chatsManager;

    this._publisher = createClient({ url });
    this._subscriber = createClient({ url });
    this._publisher.on('error', (err) => console.log('Redis Publisher Error', err));
    this._subscriber.on('error', (err) => console.log('Redis Subscriber Error', err));
  }

  async initSync() {
    await this._publisher.connect();
    await this._subscriber.connect();

    this._chatsManager.subscribe('*', this._managerHandler.bind(this));
    this._chatsManager.chats.forEach((chat) => {
      chat.subscribe('*', this._chatHandler.bind(this));
    });

    await this._subscribe(this._subscribeHandler.bind(this));
  }

  _publish(data: SyncPayload) {
    const syncData: SyncData = { ...data, instanceId: this.instanceId };
    this._publisher.publish(this._channelName, JSON.stringify(syncData));
  }
  _subscribe(cb: (data: SyncData) => void) {
    this._subscriber.subscribe(this._channelName, (data: string) => {
      let parsedData;

      try {
        parsedData = JSON.parse(data);
        assertIsSyncData(parsedData);
      } catch {
        console.error('Incorrect sync data');
      }

      if (parsedData.instanceId !== this.instanceId) {
        cb(parsedData);
      }
    });
  }

  _managerHandler(action: ManagerSubscribeActions) {
    if (action.extra?.isSyncAction) {
      return;
    }

    switch (action.type) {
      case 'CHAT_LIST_UPDATED': {
        action.payload.newChats.forEach(({ id }) => {
          this._chatsManager.getChat(id)?.subscribe('*', this._chatHandler.bind(this));
        });

        this._publish({ source: 'manager', action });
        break;
      }
      case 'CHAT_UPDATED':
        break;
      case 'CLOSE_WATCHERS_BY_META_KEY':
        this._publish({ source: 'manager', action });
        break;
      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const exhaustiveCheck: never = action;
      }
    }
  }
  _chatHandler(action: ChatSubscribeActions) {
    if (action.extra?.isSyncAction) {
      return;
    }

    switch (action.type) {
      case 'NEW_MESSAGES':
      case 'CHAT_UPDATED':
      case 'CLOSE_WATCHERS_BY_META_KEY':
        this._publish({ source: 'chat', action });
        break;
      default:
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const exhaustiveCheck: never = action;
    }
  }

  _subscribeHandler(data: SyncData) {
    const { source, action } = data;

    if (source === 'manager') {
      switch (action.type) {
        case 'CHAT_LIST_UPDATED':
          action.payload.deletedChatsIds.forEach((chatId) => this._chatsManager.deleteChat(chatId, { isSyncAction: true }));
          action.payload.newChats.forEach(({ id }) => {
            const chat = Chat.restoreChat(id);
            chat.subscribe('*', this._chatHandler.bind(this));
            this._chatsManager.addChat(chat, { isSyncAction: true });
          });
          break;
        case 'CHAT_UPDATED':
          break;
        case 'CLOSE_WATCHERS_BY_META_KEY':
          this._chatsManager.closeWatchersByMetaKey(action.payload.key, action.payload.value);
          break;
        default:
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const exhaustiveCheck: never = action;
      }
    } else if (source === 'chat') {
      const chat = this._chatsManager.getChat(action.payload.chatId);

      switch (action.type) {
        case 'NEW_MESSAGES':
        case 'CHAT_UPDATED':
          chat?._broadcast(action.type, action.payload, { isSyncAction: true });
          break;
        case 'CLOSE_WATCHERS_BY_META_KEY':
          chat?.closeWatchersByMetaKey(action.payload.key, action.payload.value);
          break;
        default:
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const exhaustiveCheck: never = action;
      }
    }
  }
}
