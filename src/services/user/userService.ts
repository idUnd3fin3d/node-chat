import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import { userModel } from '@/model/user';
import { tokenModel } from '@/model/token';
import { tokenService } from '@/services/token';
import { manager } from '@/services/chat';
import type { TokenPair } from '@/services/token';
import { UserDto } from './userDto';
import { DEFAULT_USER_SETTINGS } from './const';
import type { AuthData } from './types';
import type { UserProfile } from './types';

export class UserService {
  async registration(username: string, password: string): Promise<AuthData> {
    const usernameCheck = await userModel.checkUsername(username);
    if (usernameCheck) {
      throw new Error('username unavailable');
    }

    const hash = await bcrypt.hash(password, 5);
    const user = {
      id: nanoid(),
      username,
      passwordHash: hash,
      settings: DEFAULT_USER_SETTINGS,
    };

    await userModel.createUser(user);

    const sessionId = nanoid();
    const tokens = tokenService.generateTokens<UserDto>(new UserDto(user, sessionId));
    await tokenModel.saveToken(tokens.refreshToken, user.id);

    return {
      ...tokens,
      user,
    };
  }

  async login(username: string, password: string): Promise<AuthData> {
    const userRecord = await userModel.getUserRecord(username);

    if (userRecord) {
      const { passwordHash, ...user } = userRecord;

      if (bcrypt.compareSync(password, passwordHash)) {
        const sessionId = nanoid();
        const tokens = tokenService.generateTokens<UserDto>(new UserDto(user, sessionId));
        await tokenModel.saveToken(tokens.refreshToken, user.id);

        return {
          ...tokens,
          user,
        };
      }
    }

    throw new Error('login failed');
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const data = tokenService.verifyToken<UserDto>(refreshToken, true);
    const isValid = await tokenModel.checkToken(refreshToken);

    if (!isValid || !data) {
      throw new Error('invalid token');
    }

    await tokenModel.deleteToken(refreshToken);
    const { sessionId, ...user } = data;
    const tokens = tokenService.generateTokens<UserDto>(new UserDto(user, sessionId));
    await tokenModel.saveToken(tokens.refreshToken, data.id);

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    const data = tokenService.verifyToken<UserDto>(refreshToken, true);

    if (!data) {
      throw new Error('invalid token');
    }

    await tokenModel.deleteToken(refreshToken);
    manager.closeWatchersByMetaKey('sessionId', data.sessionId);
    manager.chats.forEach((chat) => chat.closeWatchersByMetaKey('sessionId', data.sessionId));
  }

  async getUserProfile(id: string): Promise<UserProfile> {
    const user = await userModel.getUser(id);

    return {
      id: user?.id || id,
      username: user?.username || '',
    };
  }
}

export const userService = new UserService();
