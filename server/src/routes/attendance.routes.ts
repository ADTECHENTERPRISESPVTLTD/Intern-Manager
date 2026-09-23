import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { UserRole } from '../constants';
import { Attendance } from '../models/Attendance';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { validate } from '../middleware/validate';
import { mongoIdSchema } from '../validators/common.validator';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(async (req: any, res) => {
  const records = await Attendance.find({ internId: req.user._id }).sort({ date: -1 });
  ApiResponse.success(res, records, 'Attendance records loaded');
}));

router.get('/all', authorize(UserRole.ADMIN), asyncHandler(async (_req, res) => {
  const records = await Attendance.find().sort({ date: -1 }).limit(100);
  ApiResponse.success(res, records, 'All attendance records loaded');
}));

router.get('/:id', validate({ params: z.object({ id: mongoIdSchema }) }), asyncHandler(async (req: any, res) => {
  const record = await Attendance.findById(req.params.id);
  if (!record) {
    return res.status(404).json({ success: false, message: 'Attendance record not found', code: 'NOT_FOUND' });
  }

  if (req.user.role !== UserRole.ADMIN && record.internId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ success: false, message: 'You can only access your own attendance records', code: 'FORBIDDEN' });
  }

  ApiResponse.success(res, record, 'Attendance record loaded');
}));

export default router;
