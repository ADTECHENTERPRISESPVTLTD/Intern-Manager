import { Request, Response, NextFunction } from 'express';

/**
 * Wraps async route handlers to catch errors and forward them to Express error handler.
 * Eliminates the need for try-catch in every controller method.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
