import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { UserRole } from '../constants';
import { createPerformanceRecord, listPerformance, updatePerformanceRecord } from '../controllers/performanceController';
import { validate } from '../middleware/validate';
import { mongoIdSchema } from '../validators/common.validator';

const performanceBodySchema = z.object({
  internId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  period: z.string().min(1).optional(),
  taskCompletionRate: z.number().min(0).max(100).optional(),
  deadlineAdherence: z.number().min(0).max(100).optional(),
  attendanceRate: z.number().min(0).max(100).optional(),
  sessionCompletionRate: z.number().min(0).max(100).optional(),
  dailyReportRate: z.number().min(0).max(100).optional(),
  evaluatorNotes: z.string().optional(),
  evaluatedBy: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
});

const router = Router();
router.use(authenticate);
router.get('/', listPerformance);
router.post('/', authorize(UserRole.ADMIN), validate({ body: performanceBodySchema }), createPerformanceRecord);
router.patch('/:id', validate({ params: z.object({ id: mongoIdSchema }), body: performanceBodySchema }), updatePerformanceRecord);

export default router;
