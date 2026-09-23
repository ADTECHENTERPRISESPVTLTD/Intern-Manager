import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { buildAuthToken } from './core';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const signInUser = async ({ email, password }: { email: string; password: string }) => {
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
  if (!user) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const validPassword = await user.comparePassword(password);
  if (!validPassword) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const token = buildAuthToken({ id: user._id.toString(), role: user.role });
  return { user: user.toJSON(), token };
};
