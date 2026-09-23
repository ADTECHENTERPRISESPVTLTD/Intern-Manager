import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { UserRole } from '../constants';
import { getVerificationHistory, requestVerification, verifySession } from '../controllers/verificationController';
import { validate } from '../middleware/validate';
import { mongoIdSchema } from '../validators/common.validator';

const verificationBodySchema = z.object({
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  status: z.enum(['PENDING', 'VERIFYING', 'VERIFIED', 'FAILED', 'EXPIRED', 'UNVERIFIED']).optional(),
  externalReference: z.string().optional(),
});

const router = Router();

router.use(authenticate);
router.post('/request', validate({ body: verificationBodySchema }), requestVerification);
router.get('/history', getVerificationHistory);
router.patch('/:id', authorize(UserRole.ADMIN), validate({ params: z.object({ id: mongoIdSchema }), body: verificationBodySchema }), verifySession);

export default router;
