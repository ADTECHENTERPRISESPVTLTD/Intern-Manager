import { Request, Response } from 'express';
import { Task } from '../models/Task';
import { TaskSubmission } from '../models/TaskSubmission';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { TaskStatus, SubmissionStatus, AuditAction, NotificationType, UserRole } from '../constants';
import { writeAuditLog } from '../services/audit.service';
import { createNotification } from '../services/notification.service';

export const canAccessOwnedResource = (resourceOwnerId: string | { toString(): string } | null | undefined, currentUserId: string | { toString(): string }, currentUserRole?: string) => {
  if (!resourceOwnerId) return false;
  if (currentUserRole === UserRole.ADMIN) return true;
  return resourceOwnerId.toString() === currentUserId.toString();
};

export const ensureTaskAccess = async (taskId: string, reqUser: any) => {
  const task = await Task.findById(taskId);
  if (!task) throw AppError.notFound('Task not found');

  if (reqUser.role !== UserRole.ADMIN && task.assignedTo?.toString() !== reqUser._id.toString()) {
    throw AppError.forbidden('You can only access assigned tasks');
  }

  return task;
};

export const listTasks = asyncHandler(async (req: any, res: Response) => {
  const filter = req.user.role === UserRole.ADMIN ? {} : { assignedTo: req.user._id };
  const tasks = await Task.find(filter).sort({ createdAt: -1 });
  ApiResponse.success(res, tasks, 'Tasks retrieved');
});

export const createTask = asyncHandler(async (req: any, res: Response) => {
  const task = await Task.create({
    ...req.body,
    createdBy: req.user._id,
  });

  await writeAuditLog({
    actor: req.user._id,
    action: AuditAction.TASK_CREATED,
    target: task._id,
    targetType: 'Task',
    metadata: { title: task.title, assignedTo: task.assignedTo?.toString() || null },
  });

  ApiResponse.created(res, task, 'Task created');
});

export const getTaskById = asyncHandler(async (req: any, res: Response) => {
  const task = await ensureTaskAccess(req.params.id, req.user);
  ApiResponse.success(res, task, 'Task loaded');
});

export const updateTask = asyncHandler(async (req: any, res: Response) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw AppError.notFound('Task not found');

  const updatedTask = await Task.findByIdAndUpdate(
    req.params.id,
    { $set: { ...req.body, updatedAt: new Date() } },
    { new: true }
  );

  await writeAuditLog({
    actor: req.user._id,
    action: AuditAction.TASK_EDITED,
    target: task._id,
    targetType: 'Task',
    metadata: { changes: req.body },
  });

  ApiResponse.success(res, updatedTask, 'Task updated');
});

export const assignTask = asyncHandler(async (req: any, res: Response) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw AppError.notFound('Task not found');

  task.assignedTo = req.body.assignedTo;
  task.status = task.status === TaskStatus.NOT_STARTED ? TaskStatus.IN_PROGRESS : task.status;
  await task.save();

  await createNotification({
    recipientId: req.body.assignedTo,
    type: NotificationType.TASK_ASSIGNED,
    title: 'Task assigned',
    message: `You were assigned task: ${task.title}`,
    referenceId: task._id.toString(),
    referenceType: 'Task',
  });

  await writeAuditLog({
    actor: req.user._id,
    action: AuditAction.TASK_ASSIGNED,
    target: task._id,
    targetType: 'Task',
    metadata: { assignedTo: req.body.assignedTo },
  });

  ApiResponse.success(res, task, 'Task assigned');
});

export const updateProgress = asyncHandler(async (req: any, res: Response) => {
  const task = await ensureTaskAccess(req.params.id, req.user);

  task.progress = Number(req.body.progress);
  task.status = req.body.status || (task.progress >= 100 ? TaskStatus.SUBMITTED : TaskStatus.IN_PROGRESS);
  await task.save();

  ApiResponse.success(res, task, 'Task progress updated');
});

export const submitTask = asyncHandler(async (req: any, res: Response) => {
  const task = await ensureTaskAccess(req.params.id, req.user);

  const submission = await TaskSubmission.create({
    taskId: task._id,
    submittedBy: req.user._id,
    links: req.body.links,
    notes: req.body.notes,
    status: SubmissionStatus.SUBMITTED,
  });

  task.status = TaskStatus.SUBMITTED;
  await task.save();

  await createNotification({
    recipientId: task.createdBy.toString(),
    type: NotificationType.TASK_UPDATED,
    title: 'Task submitted',
    message: `Task "${task.title}" was submitted for review`,
    referenceId: task._id.toString(),
    referenceType: 'Task',
  });

  ApiResponse.created(res, submission, 'Task submitted');
});

export const reviewSubmission = asyncHandler(async (req: any, res: Response) => {
  const submission = await TaskSubmission.findById(req.params.id);
  if (!submission) throw AppError.notFound('Submission not found');

  const task = await Task.findById(submission.taskId);
  if (!task) throw AppError.notFound('Related task not found');

  if (req.user.role !== UserRole.ADMIN) {
    throw AppError.forbidden('Only admins can review submissions');
  }

  submission.status = req.body.status;
  submission.feedback = req.body.feedback || submission.feedback;
  submission.reviewer = req.user._id;
  submission.reviewedAt = new Date();
  await submission.save();

  task.status = req.body.status === SubmissionStatus.APPROVED ? TaskStatus.COMPLETED : TaskStatus.REWORK_REQUIRED;
  task.feedback = req.body.feedback || task.feedback;
  await task.save();

  await createNotification({
    recipientId: submission.submittedBy.toString(),
    type: NotificationType.TASK_REVIEWED,
    title: 'Task review complete',
    message: `Your task was ${req.body.status === SubmissionStatus.APPROVED ? 'approved' : 'returned for rework'}`,
    referenceId: task._id.toString(),
    referenceType: 'Task',
  });

  await writeAuditLog({
    actor: req.user._id,
    action: AuditAction.TASK_REVIEWED,
    target: submission._id,
    targetType: 'TaskSubmission',
    metadata: { taskId: task._id.toString(), status: req.body.status },
  });

  ApiResponse.success(res, submission, 'Submission reviewed');
});
