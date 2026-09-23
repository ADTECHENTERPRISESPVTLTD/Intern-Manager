import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { UserRole } from '../constants';
import {
  getStatus,
  requestVerification,
  verifyPresenceFrame,
  registerFace,
  getRegistrationStatus,
  getVerificationHistory,
  verifySession,
} from '../controllers/verificationController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 3 * 1024 * 1024, // 3 MB max per frame
    files: 5,
  },
});

const router = Router();

router.use(authenticate);

// Real-time verification status check (polled by frontend)
router.get('/status', getStatus);

// Explicit trigger / check retrieval
router.post('/request', requestVerification);

// Verify presence using camera frame
router.post('/verify', upload.single('frame'), verifyPresenceFrame);

// Register face with 3-5 reference frames
router.post('/registration', upload.array('frames', 5), registerFace);
router.get('/registration', getRegistrationStatus);

// Verification history
router.get('/history', getVerificationHistory);

// Admin manual override
router.patch('/:id', authorize(UserRole.ADMIN), verifySession);

export default router;
