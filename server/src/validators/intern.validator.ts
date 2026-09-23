import { z } from 'zod';

export const updateProfileSchema = z.object({
  designation: z.string().trim().optional(),
  profilePhoto: z.string().url('Invalid profile photo URL').optional().nullable(),
  joiningDate: z.string().datetime().optional(),
  internshipDuration: z.string().optional(),
  skills: z.array(z.string()).optional(),
  department: z.string().trim().optional(),
  internshipStatus: z.enum(['ACTIVE', 'COMPLETED', 'TERMINATED', 'ON_LEAVE']).optional(),
  bio: z.string().max(500, 'Bio must not exceed 500 characters').optional(),
  phone: z.string().trim().optional(),
});

export const createInternSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(6).max(128),
  designation: z.string().trim(),
  joiningDate: z.string(),
  internshipDuration: z.string().optional().default('3 months'),
  skills: z.array(z.string()).optional().default([]),
  department: z.string().trim().optional().default(''),
});

export const changeDesignationSchema = z.object({
  designation: z.string().trim().min(1, 'Designation is required'),
});

export const changeStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
});

export const mongoIdParam = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});
