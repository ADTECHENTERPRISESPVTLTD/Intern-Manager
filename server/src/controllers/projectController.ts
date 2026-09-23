import { Request, Response } from 'express';
import { Project } from '../models/Project';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { UserRole } from '../constants';

export const listProjects = asyncHandler(async (req: any, res: Response) => {
  const filter = req.user.role === UserRole.ADMIN ? {} : { team: req.user._id };
  const projects = await Project.find(filter).sort({ createdAt: -1 });
  ApiResponse.success(res, projects, 'Projects retrieved');
});

export const createProject = asyncHandler(async (req: any, res: Response) => {
  const project = await Project.create({
    ...req.body,
    createdBy: req.user._id,
  });

  ApiResponse.created(res, project, 'Project created');
});

export const getProjectById = asyncHandler(async (req: any, res: Response) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw AppError.notFound('Project not found');

  if (req.user.role !== UserRole.ADMIN && !project.team.some((memberId: any) => memberId.toString() === req.user._id.toString())) {
    throw AppError.forbidden('You do not have access to this project');
  }

  ApiResponse.success(res, project, 'Project details loaded');
});

export const updateProject = asyncHandler(async (req: any, res: Response) => {
  const project = await Project.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!project) throw AppError.notFound('Project not found');
  ApiResponse.success(res, project, 'Project updated');
});
