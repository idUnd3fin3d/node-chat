import type { RequestHandler, Request, Response } from 'express';
import type { WebsocketRequestHandler } from 'express-ws';
import type * as WebSocket from 'ws';
import { HttpError } from '@/utils/errors';
import { tokenService } from '@/services/token';
import type { UserDto } from '@/services/user';

const closeOnTokenExpire = (req: Request, res: Response | WebSocket, closeRequest: () => void) => {
  const closeTimeout = (req.tokenData?.exp || 0) * 1000 - new Date().valueOf();
  const timer = setTimeout(closeRequest, closeTimeout);

  const clearTimer = () => clearTimeout(timer);
  res.on('close', clearTimer);
  res.on('error', clearTimer);
};

export const authMiddleware: RequestHandler = (req, res, next) => {
  const accessToken = req.headers.authorization?.split(' ')[1];

  if (accessToken) {
    const data = tokenService.verifyToken<UserDto>(accessToken);

    if (data) {
      req.tokenData = data;

      closeOnTokenExpire(req, res, () => {
        res.statusCode = 401;
        res.json({ message: 'Unauthorized' });
      });

      return next();
    }
  }

  throw new HttpError(401, 'Unauthorized');
};

export const sseAuthMiddleware: RequestHandler = (req, res, next) => {
  const { accessToken } = req.query;

  if (accessToken) {
    const data = tokenService.verifyToken<UserDto>(String(accessToken));

    if (data) {
      req.tokenData = data;

      closeOnTokenExpire(req, res, () => {
        res.end('event: unauthorized\ndata: {"status": 401}\n\n');
      });

      return next();
    }
  }

  throw new HttpError(401, 'Unauthorized');
};

export const wsAuthMiddleware: WebsocketRequestHandler = (ws, req, next) => {
  const { accessToken } = req.query;

  if (accessToken) {
    const data = tokenService.verifyToken<UserDto>(String(accessToken));

    if (data) {
      req.tokenData = data;

      closeOnTokenExpire(req, ws, () => ws.close(3000));

      return next();
    }
  }

  ws.terminate();
};
