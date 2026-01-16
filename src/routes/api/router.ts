import { Router } from 'express';
import { body, query, cookie } from 'express-validator';
import { authMiddleware } from '@/middleware/auth';
import { getNameChain, getIdChain, getSettingsChains, getPasswordChain } from '@/utils/validation';
import { asyncHandler } from '@/utils/errors';
import {
  getUser,
  editUser,
  getChats,
  createChat,
  chatsSubscribe,
  joinChat,
  quitChat,
  subscribeChat,
  publishMessage,
  getMessages,
  registration,
  login,
  logout,
  refreshToken,
  MESSAGES_DIRECTIONS,
  getUserProfile,
} from '@/controllers/api';
import { MAX_MESSAGE_LENGTH } from '@/const/limits';

export const router = Router();

router.post('/auth/registration', getNameChain('username'), getPasswordChain(), asyncHandler(registration));
router.post('/auth/login', getNameChain('username'), getPasswordChain(), asyncHandler(login));
router.post('/auth/logout', cookie('refreshToken').isString(), asyncHandler(logout));
router.post('/auth/refresh', cookie('refreshToken').isString(), asyncHandler(refreshToken));

router.post('/user', authMiddleware, getNameChain('username'), ...getSettingsChains(), asyncHandler(editUser));
router.get('/user', authMiddleware, asyncHandler(getUser));
router.get('/user-profile', authMiddleware, getIdChain('userId', 'query'), asyncHandler(getUserProfile));
router.post('/chats', authMiddleware, getNameChain('name'), asyncHandler(createChat));
router.get('/chats', authMiddleware, asyncHandler(getChats));
router.get('/chats-subscribe', authMiddleware, asyncHandler(chatsSubscribe));
router.post('/join', authMiddleware, getIdChain('chatId'), asyncHandler(joinChat));
router.post('/quit', authMiddleware, getIdChain('chatId'), asyncHandler(quitChat));
router.get(
  '/subscribe',
  authMiddleware,
  getIdChain('chatId', 'query'),
  getIdChain('lastMessageId', 'query').optional(),
  asyncHandler(subscribeChat),
);
router.post(
  '/publish',
  authMiddleware,
  getIdChain('chatId'),
  body('message')
    .isString()
    .trim()
    .isLength({ min: 1, max: MAX_MESSAGE_LENGTH })
    .withMessage(`Message must be length from 1 to ${MAX_MESSAGE_LENGTH}`),
  asyncHandler(publishMessage),
);
router.get(
  '/messages',
  authMiddleware,
  getIdChain('chatId', 'query'),
  getIdChain('lastMessageId', 'query').optional(),
  query('direction')
    .default(MESSAGES_DIRECTIONS.NEXT)
    .matches(`^(${MESSAGES_DIRECTIONS.PREV}|${MESSAGES_DIRECTIONS.NEXT})$`)
    .withMessage(`Direction must be '${MESSAGES_DIRECTIONS.PREV}' or '${MESSAGES_DIRECTIONS.NEXT}'`),
  asyncHandler(getMessages),
);
