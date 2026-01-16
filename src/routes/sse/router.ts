import { Router } from 'express';
import { sseAuthMiddleware } from '@/middleware/auth';
import { sseMiddleware } from '@/middleware/sse';
import { getIdChain } from '@/utils/validation';
import { asyncHandler } from '@/utils/errors';
import { chatsSubscribeSSE, subscribeSSE } from '@/controllers/sse';

export const router = Router();

router.get('/chats-subscribe', sseAuthMiddleware, sseMiddleware, chatsSubscribeSSE);
router.get(
  '/subscribe',
  sseAuthMiddleware,
  sseMiddleware,
  getIdChain('chatId', 'query'),
  getIdChain('lastMessageId', 'query').optional(),
  getIdChain('last-event-id', 'header').optional(),
  asyncHandler(subscribeSSE),
);
