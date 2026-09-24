import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { UserRole } from '../constants';
import {
  getRegistrationStatus,
  getVerificationHistory,
  getVerificationStatus,
  registerFaceHandler,
  requestVerification,
  submitVerification,
  verifySession,
} from '../controllers/verificationController';
import { validate } from '../middleware/validate';
import { mongoIdSchema } from '../validators/common.validator';

const verificationBodySchema = z.object({
  sessionId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  status: z.enum(['PENDING', 'VERIFYING', 'VERIFIED', 'FAILED', 'EXPIRED', 'UNVERIFIED']).optional(),
  externalReference: z.string().optional(),
});

// Memory storage only — a camera frame is never written to disk, matching the privacy rule
// in ai-service/README.md ("frames are decoded in memory and dropped"). 2 MB/frame is the
// same cap ai-service enforces; 5 frames covers the registration upload.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 5 } });

const router = Router();

router.use(authenticate);
router.get('/status', getVerificationStatus);
router.post('/request', validate({ body: verificationBodySchema }), requestVerification);
router.get('/history', getVerificationHistory);
router.post('/registration', upload.array('frames', 5), registerFaceHandler);
router.get('/registration', getRegistrationStatus);
router.post('/:id/verify', validate({ params: z.object({ id: mongoIdSchema }) }), upload.single('frame'), submitVerification);
router.patch('/:id', authorize(UserRole.ADMIN), validate({ params: z.object({ id: mongoIdSchema }), body: verificationBodySchema }), verifySession);

export default router;
