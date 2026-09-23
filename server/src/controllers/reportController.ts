import { Request, Response } from 'express';
import { DailyReport } from '../models/DailyReport';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';

export const createReport = asyncHandler(async (req: any, res: Response) => {
  const submittedDate = req.body.date ? new Date(req.body.date) : new Date();
  const existing = await DailyReport.findOne({ internId: req.user._id, date: submittedDate });
  if (existing) {
    throw AppError.conflict('Daily report already submitted for this date');
  }

  const report = await DailyReport.create({
    ...req.body,
    internId: req.user._id,
    date: submittedDate,
  });

  ApiResponse.created(res, report, 'Daily report submitted');
});

export const listReports = asyncHandler(async (req: any, res: Response) => {
  const reports = await DailyReport.find({ internId: req.user._id }).sort({ date: -1 });
  ApiResponse.success(res, reports, 'Reports loaded');
});
