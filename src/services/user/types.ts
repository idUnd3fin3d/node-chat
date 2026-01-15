import type { User } from '@/model/user';
import type { TokenPair } from '@/services/token';

export type AuthData = TokenPair & {
  user: User;
};

export type UserProfile = Omit<User, 'settings'>;
