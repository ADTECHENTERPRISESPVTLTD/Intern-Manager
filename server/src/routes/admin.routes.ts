import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { UserRole } from '../constants';
import {
  adminOverview,
  changeUserStatus,
  listAllSessions,
  listAllUsers,
  listAttendanceRecords,
  listInternsForAdmin,
} from '../controllers/adminController';

const router = Router();
router.use(authenticate, authorize(UserRole.ADMIN));

router.get('/overview', adminOverview);
router.get('/interns', listInternsForAdmin);
router.get('/users', listAllUsers);
router.get('/sessions', listAllSessions);
router.get('/attendance', listAttendanceRecords);
router.patch('/users/:id/status', changeUserStatus);

export default router;
