import { Request, Response } from 'express';
import { ApiResponse } from '../utils/ApiResponse';

export const healthCheck = (_req: Request, res: Response): void => {
  ApiResponse.success(res, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }, 'Backend is healthy');
};
