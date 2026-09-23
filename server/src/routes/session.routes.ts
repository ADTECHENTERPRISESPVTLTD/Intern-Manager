import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  currentSession,
  heartbeat,
  listAttendance,
  startBreakSession,
  startSession,
  resumeSession,
  getBreakHistory,
} from '../controllers/sessionController';

const router = Router();

router.use(authenticate);

router.post('/start', startSession);
router.get('/current', currentSession);

// Support both param-based and body/context-based calls
router.post('/break', startBreakSession);
router.post('/:id/break', startBreakSession);

router.post('/resume', resumeSession);
router.post('/:id/resume', resumeSession);

router.post('/heartbeat', heartbeat);
router.post('/:id/heartbeat', heartbeat);

router.get('/attendance', listAttendance);
router.get('/breaks', getBreakHistory);

export default router;
