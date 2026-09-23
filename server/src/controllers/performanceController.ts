import { Request, Response } from 'express';
import { PerformanceRecord } from '../models/PerformanceRecord';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export const listPerformance = asyncHandler(async (req: any, res: Response) => {
  const records = await PerformanceRecord.find({ internId: req.user._id }).sort({ createdAt: -1 });
  ApiResponse.success(res, records, 'Performance records loaded');
});

export const createPerformanceRecord = asyncHandler(async (req: Request, res: Response) => {
  const record = await PerformanceRecord.create({
    ...req.body,
    evaluatedBy: req.body.evaluatedBy || null,
  });
  ApiResponse.created(res, record, 'Performance record created');
});

export const updatePerformanceRecord = asyncHandler(async (req: any, res: Response) => {
  const record = await PerformanceRecord.findById(req.params.id);
  if (!record) throw AppError.notFound('Performance record not found');

  if (req.user.role !== 'ADMIN' && record.internId.toString() !== req.user._id.toString()) {
    throw AppError.forbidden('You can only update your own performance record');
  }

  const updatedRecord = await PerformanceRecord.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  ApiResponse.success(res, updatedRecord, 'Performance record updated');
});
