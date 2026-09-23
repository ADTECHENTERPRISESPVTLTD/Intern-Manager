import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { getUserNotifications } from '../services/notification.service';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(async (req: any, res) => {
  const notifications = await getUserNotifications(req.user._id.toString());
  ApiResponse.success(res, notifications, 'Notifications loaded');
}));

export default router;
