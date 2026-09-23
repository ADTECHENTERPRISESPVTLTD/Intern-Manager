import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { currentSession, heartbeat, listAttendance, startBreakSession, startSession, resumeSession, getBreakHistory } from '../controllers/sessionController';
import { validate } from '../middleware/validate';
import { mongoIdSchema } from '../validators/common.validator';

const router = Router();

router.use(authenticate);
router.post('/start', startSession);
router.get('/current', currentSession);
router.post('/:id/heartbeat', validate({ params: z.object({ id: mongoIdSchema }) }), heartbeat);
router.post('/:id/break', validate({ params: z.object({ id: mongoIdSchema }) }), startBreakSession);
router.post('/:id/resume', validate({ params: z.object({ id: mongoIdSchema }) }), resumeSession);
router.get('/attendance', listAttendance);
router.get('/breaks', getBreakHistory);

export default router;
