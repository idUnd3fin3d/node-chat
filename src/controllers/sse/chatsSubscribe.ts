import type { RequestHandler } from 'express';
import { manager, MANAGER_SUBSCRIBE_TYPES } from '@/services/chat';
import type { WatchChatsPayload } from '@/controllers/types';
import { getTokenData } from '@/utils/validation';

type SSEData = WatchChatsPayload;

export const chatsSubscribeSSE: RequestHandler<Record<string, never>, string> = (req, res) => {
  const { id: userId, sessionId } = getTokenData(req);

  const onClose = () => {
    manager.unsubscribe(defaultWatcherId);
    manager.unsubscribe(chatUpdatedWatcherId);
  };
  res.on('close', onClose);
  res.on('error', onClose);

  const writeToUser = (data: SSEData) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const defaultWatcherId = manager.subscribe(
    MANAGER_SUBSCRIBE_TYPES.CHAT_LIST_UPDATED,
    ({ payload }) => {
      writeToUser({ ...payload, updatedChats: [] });
    },
    { userId, sessionId },
    () => res.end(),
  );

  const chatUpdatedWatcherId = manager.subscribe(
    MANAGER_SUBSCRIBE_TYPES.CHAT_UPDATED,
    async ({ payload }) => {
      const { chatId, onlyForJoined } = payload;

      const chat = manager.getChat(chatId);

      if (chat && (!onlyForJoined || (await chat.isJoined(userId)))) {
        writeToUser({ updatedChats: [await chat.getChatEntity(userId, false)], newChats: [], deletedChatsIds: [] });
      }
    },
    { userId, sessionId },
    () => res.end(),
  );
};
