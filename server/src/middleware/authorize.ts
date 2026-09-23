import { Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { AuthRequest } from '../types';
import { UserRole } from '../constants';

/**
 * Role-based authorization middleware.
 * Must be used AFTER authenticate middleware.
 * Checks that the authenticated user has one of the allowed roles.
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};
