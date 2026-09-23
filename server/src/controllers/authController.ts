import { Request, Response } from 'express';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { signInUser } from '../services/auth.service';
import { buildAuthToken } from '../services/core';
import { UserRole, UserStatus } from '../constants';
import { revokeTokenFromRequest } from '../services/revocation.service';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role = UserRole.INTERN } = req.body;

  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (existingUser) {
    throw AppError.conflict('User with this email already exists');
  }

  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    password,
    role,
    status: UserStatus.ACTIVE,
  });

  const token = buildAuthToken({ id: user._id.toString(), role: user.role });

  ApiResponse.created(
    res,
    {
      user: user.toJSON(),
      token,
    },
    'User registered successfully'
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const payload = await signInUser({ email, password });

  ApiResponse.success(res, payload, 'Login successful');
});

export const getCurrentUser = asyncHandler(async (req: any, res: Response) => {
  const user = await User.findById(req.user._id).select('-password');
  if (!user) {
    throw AppError.notFound('User not found');
  }

  ApiResponse.success(res, user, 'User profile loaded');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  revokeTokenFromRequest(req.headers.authorization);
  ApiResponse.success(res, { loggedOut: true }, 'Logout successful');
});
