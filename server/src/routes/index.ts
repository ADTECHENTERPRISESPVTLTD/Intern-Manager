import { Router } from 'express';
import authRoutes from './auth.routes';
import internRoutes from './intern.routes';
import projectRoutes from './project.routes';
import taskRoutes from './task.routes';
import sessionRoutes from './session.routes';
import attendanceRoutes from './attendance.routes';
import breakRoutes from './breaks.routes';
import verificationRoutes from './verification.routes';
import reportRoutes from './report.routes';
import performanceRoutes from './performance.routes';
import documentRoutes from './document.routes';
import notificationRoutes from './notifications.routes';
import adminRoutes from './admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/interns', internRoutes);
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/sessions', sessionRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/breaks', breakRoutes);
router.use('/verifications', verificationRoutes);
router.use('/reports', reportRoutes);
router.use('/performance', performanceRoutes);
router.use('/documents', documentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

export default router;
