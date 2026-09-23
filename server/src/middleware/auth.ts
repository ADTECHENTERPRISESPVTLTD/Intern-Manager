import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AppError } from '../utils/AppError';
import { env } from '../config/env';
import { AuthRequest, AuthUser } from '../types';
import { isTokenRevoked } from '../services/revocation.service';

/**
 * JWT authentication middleware.
 * Extracts token from Authorization header, verifies it,
 * loads the user, and attaches to request.
 * 
 * IMPORTANT: The role is always read from the database user record,
 * never trusted from the token payload alone.
 */
export const authenticate = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('No authentication token provided');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw AppError.unauthorized('No authentication token provided');
    }

    if (isTokenRevoked(token)) {
      throw AppError.unauthorized('Authentication token has been revoked');
    }

    // Verify token
    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw AppError.unauthorized('Authentication token has expired');
      }
      throw AppError.unauthorized('Invalid authentication token');
    }

    if (isTokenRevoked(token)) {
      throw AppError.unauthorized('Authentication token has been revoked');
    }

    // Load user from database — role comes from DB, not from token
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      throw AppError.unauthorized('User no longer exists');
    }

    if (user.status !== 'ACTIVE') {
      throw AppError.unauthorized('User account is not active');
    }

    // Attach authenticated user to request
    req.user = {
      _id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    } as AuthUser;

    next();
  } catch (error) {
    next(error);
  }
};
