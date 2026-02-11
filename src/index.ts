import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import expressWs from 'express-ws';
import { COMMON_CONFIG } from '@/config/common';
import { corsMiddleware } from '@/middleware/cors';
import { errorMiddleware } from '@/middleware/error';
import { checkQuery } from '@/middleware/check-query';
import { router as apiRouter } from '@/routes/api';
import { router as sseRouter } from '@/routes/sse';
import { manager } from '@/services/chat';
import { ChatSyncService } from '@/services/chatSync';

const app = express();
const { app: wsApp } = expressWs(app);

app.use(checkQuery);

app.use(bodyParser.json({ limit: '10kb' }));
app.use(cookieParser());

app.use(corsMiddleware);

app.use('/api', apiRouter);
// eslint-disable-next-line @typescript-eslint/no-require-imports
wsApp.use('/ws', require('@/routes/ws').router);
app.use('/sse', sseRouter);

app.use(errorMiddleware);

manager
  .initChats()
  .then(() => {
    if (COMMON_CONFIG.REDIS_URL) {
      const syncManager = new ChatSyncService(manager, COMMON_CONFIG.REDIS_URL, COMMON_CONFIG.REDIS_CHANNEL_NAME);
      return syncManager.initSync();
    }
  })
  .then(() => {
    app.listen(COMMON_CONFIG.PORT, () => {
      console.log(`Server started on port ${COMMON_CONFIG.PORT}`);
    });
  });
