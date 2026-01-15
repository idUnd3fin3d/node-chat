import type { RequestHandler } from 'express';
import type { User, UserProfile } from '@/controllers/types';
import { validateParams } from '@/utils/validation';
import { userService } from '@/services/user';

type Input = {
  userId: User['id'];
};
type Output = UserProfile;

export const getUserProfile: RequestHandler<Record<string, never>, Output, Input> = async (req, res) => {
  const { userId } = validateParams<Input>(req);

  const user = await userService.getUserProfile(userId);

  res.json(user);
};
