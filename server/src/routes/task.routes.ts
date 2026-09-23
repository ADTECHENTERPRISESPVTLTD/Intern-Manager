import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { UserRole } from '../constants';
import { assignTask, createTask, getTaskById, listTasks, reviewSubmission, submitTask, updateProgress, updateTask } from '../controllers/taskController';
import { validate } from '../middleware/validate';
import { createTaskSchema, editTaskSchema, assignTaskSchema, updateProgressSchema, submitTaskSchema, reviewSubmissionSchema } from '../validators/task.validator';
import { mongoIdParam } from '../validators/intern.validator';

const router = Router();

router.use(authenticate);
router.get('/', listTasks);
router.post('/', authorize(UserRole.ADMIN), validate({ body: createTaskSchema }), createTask);
router.get('/:id', validate({ params: mongoIdParam }), getTaskById);
router.patch('/:id', authorize(UserRole.ADMIN), validate({ params: mongoIdParam, body: editTaskSchema }), updateTask);
router.patch('/:id/assign', authorize(UserRole.ADMIN), validate({ params: mongoIdParam, body: assignTaskSchema }), assignTask);
router.patch('/:id/progress', validate({ params: mongoIdParam, body: updateProgressSchema }), updateProgress);
router.post('/:id/submit', validate({ params: mongoIdParam, body: submitTaskSchema }), submitTask);
router.patch('/:id/review', authorize(UserRole.ADMIN), validate({ params: mongoIdParam, body: reviewSubmissionSchema }), reviewSubmission);

export default router;
