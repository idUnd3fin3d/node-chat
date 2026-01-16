import type { JwtPayload } from 'jsonwebtoken';
import type { UserDto } from '@/services/user';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      tokenData?: JwtPayload & UserDto;
    }
  }
}
