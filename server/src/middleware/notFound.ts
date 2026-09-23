import { Request, Response, NextFunction } from 'express';

/**
 * 404 handler for unmatched routes.
 */
export const notFoundHandler = (_req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${_req.method} ${_req.originalUrl}`,
    code: 'NOT_FOUND',
  });
};
