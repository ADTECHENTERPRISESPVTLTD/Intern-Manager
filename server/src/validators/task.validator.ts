import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  description: z.string().optional().default(''),
  assignedTo: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID').optional(),
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid project ID').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().default('MEDIUM'),
  deadline: z.string().datetime().optional(),
  requirements: z.array(z.string()).optional().default([]),
  resources: z.array(z.string()).optional().default([]),
});

export const editTaskSchema = z.object({
  title: z.string().min(1).trim().optional(),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  deadline: z.string().datetime().optional().nullable(),
  requirements: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
  status: z
    .enum([
      'NOT_STARTED',
      'IN_PROGRESS',
      'SUBMITTED',
      'UNDER_REVIEW',
      'COMPLETED',
      'REWORK_REQUIRED',
    ])
    .optional(),
});

export const assignTaskSchema = z.object({
  assignedTo: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
});

export const updateProgressSchema = z.object({
  progress: z.number().min(0).max(100),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS']).optional(),
});

export const submitTaskSchema = z.object({
  links: z
    .array(
      z.object({
        type: z.enum(['github', 'deployment', 'document', 'video', 'other']),
        url: z.string().url('Invalid URL'),
        label: z.string().optional(),
      })
    )
    .min(1, 'At least one proof-of-work link is required'),
  notes: z.string().optional(),
});

export const reviewSubmissionSchema = z.object({
  status: z.enum(['APPROVED', 'REWORK_REQUIRED']),
  feedback: z.string().optional(),
});
