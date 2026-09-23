import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { createReport, listReports } from '../controllers/reportController';
import { validate } from '../middleware/validate';

const reportBodySchema = z.object({
  date: z.string().datetime().optional(),
  workSummary: z.string().min(1).max(2000),
  completedWork: z.array(z.string()).optional().default([]),
  learning: z.string().optional().default(''),
  blockers: z.array(z.string()).optional().default([]),
  proofLinks: z.array(z.string().url()).optional().default([]),
  status: z.enum(['DRAFT', 'SUBMITTED', 'REVIEWED']).optional(),
});

const router = Router();
router.use(authenticate);
router.get('/', listReports);
router.post('/', validate({ body: reportBodySchema }), createReport);

export default router;
