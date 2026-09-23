import { z } from 'zod';

export const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
export const urlSchema = z.string().url('Invalid URL');
export const optionalUrlSchema = z.string().url('Invalid URL').optional().nullable();
export const dateStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid date');
