import { Request } from 'express';
import { Types } from 'mongoose';
import { UserRole } from '../constants';

// --- Authenticated User (attached to request by auth middleware) ---
export interface AuthUser {
  _id: Types.ObjectId;
  email: string;
  name: string;
  role: UserRole;
}

// --- Express Request with authenticated user ---
export interface AuthRequest extends Request {
  user?: AuthUser;
}

// --- API Response ---
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code: string;
  errors?: Array<{ field?: string; message: string }>;
}

// --- Pagination ---
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// --- Date range filter ---
export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}
