import type { RequestHandler } from 'express';
import { CHAT_SUBSCRIBE_TYPES, manager } from '@/services/chat';
import type { Chat, Message, SubscribedChatPayload } from '@/controllers/types';
import { getTokenData, validateParams } from '@/utils/validation';
import { ChatNotFound, NotJoinedChat } from '@/utils/errors';

type Headers = {
  'last-event-id'?: string;
};
type GetInput = {
  chatId: Chat['id'];
  lastMessageId?: Message['id'];
};
type SSEData = SubscribedChatPayload;

export const subscribeSSE: RequestHandler<Record<string, never>, string, GetInput> = async (req, res) => {
  const { chatId, lastMessageId: lastMessageIdParam, ...rest } = validateParams<GetInput & Headers>(req);
  const lastMessageId: string | undefined = rest['last-event-id'] || lastMessageIdParam;
  const { id: userId, sessionId } = getTokenData(req);

  const chat = manager.getChat(chatId);

  if (!chat) {
    throw new ChatNotFound();
  }

  const writeToUser = (data: SSEData) => {
    res.write(`data: ${JSON.stringify(data)}\nid: ${data.messages[data.messages.length - 1].id}\n\n`);
  };

  await (async () => {
    let unreceivedMessages: Message[] | null = [];

    if (lastMessageId) {
      unreceivedMessages = await chat.getMessages(userId, lastMessageId);
    }

    if (unreceivedMessages === null) {
      throw new NotJoinedChat();
    } else if (unreceivedMessages.length) {
      writeToUser({ chatId, messages: unreceivedMessages });
    }
  })();

  const watcherId = await chat.subscribeIfJoined(
    CHAT_SUBSCRIBE_TYPES.NEW_MESSAGES,
    ({ payload }) => {
      writeToUser(payload);
    },
    { userId, sessionId },
    () => res.end(),
  );

  if (watcherId !== null) {
    const onClose = () => {
      chat.unsubscribe(watcherId as string);
    };
    res.on('close', onClose);
    res.on('error', onClose);
  } else {
    throw new NotJoinedChat();
  }
};
