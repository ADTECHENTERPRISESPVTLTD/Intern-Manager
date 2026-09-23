import { Response } from 'express';
import { ApiSuccessResponse, ApiErrorResponse, PaginatedResult } from '../types';

export class ApiResponse {
  static success<T>(res: Response, data: T, message: string = 'Success', statusCode: number = 200): Response {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
      message,
    };
    return res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data: T, message: string = 'Created successfully'): Response {
    return ApiResponse.success(res, data, message, 201);
  }

  static paginated<T>(
    res: Response,
    result: PaginatedResult<T>,
    message: string = 'Success'
  ): Response {
    return res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      message,
    });
  }

  static error(
    res: Response,
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    errors?: Array<{ field?: string; message: string }>
  ): Response {
    const response: ApiErrorResponse = {
      success: false,
      message,
      code,
      errors,
    };
    return res.status(statusCode).json(response);
  }
}
