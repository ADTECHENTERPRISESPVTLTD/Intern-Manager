import { Request, Response } from 'express';
import { User } from '../models/User';
import { InternProfile } from '../models/InternProfile';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { UserRole } from '../constants';

export const getMyProfile = asyncHandler(async (req: any, res: Response) => {
  const profile = await InternProfile.findOne({ userId: req.user._id }).populate('userId');
  if (!profile) {
    throw AppError.notFound('Intern profile not found');
  }

  ApiResponse.success(res, profile, 'Intern profile loaded');
});

export const updateMyProfile = asyncHandler(async (req: any, res: Response) => {
  const profile = await InternProfile.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { ...req.body } },
    { new: true, upsert: true }
  );

  ApiResponse.success(res, profile, 'Intern profile updated');
});

export const listInterns = asyncHandler(async (_req: Request, res: Response) => {
  const interns = await User.find({ role: UserRole.INTERN }).select('-password').lean();
  ApiResponse.success(res, interns, 'Interns retrieved');
});

export const createIntern = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, designation, joiningDate, internshipDuration, skills, department } = req.body;
  const existing = await User.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw AppError.conflict('Intern with this email already exists');
  }

  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    password,
    role: UserRole.INTERN,
  });

  const profile = await InternProfile.create({
    userId: user._id,
    designation,
    joiningDate: new Date(joiningDate),
    internshipDuration: internshipDuration || '3 months',
    skills: skills || [],
    department: department || '',
  });

  ApiResponse.created(res, { user, profile }, 'Intern created');
});
