import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { UserRole } from '../constants';
import { createProject, getProjectById, listProjects, updateProject } from '../controllers/projectController';
import { validate } from '../middleware/validate';
import { mongoIdSchema } from '../validators/common.validator';

const projectBodySchema = z.object({
  name: z.string().min(1).trim().optional(),
  description: z.string().optional(),
  team: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
  technologyStack: z.array(z.string()).optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  repository: z.string().url().optional().nullable(),
  deploymentUrl: z.string().url().optional().nullable(),
});

const router = Router();

router.use(authenticate);
router.get('/', listProjects);
router.post('/', authorize(UserRole.ADMIN), validate({ body: projectBodySchema }), createProject);
router.get('/:id', validate({ params: z.object({ id: mongoIdSchema }) }), getProjectById);
router.patch('/:id', authorize(UserRole.ADMIN), validate({ params: z.object({ id: mongoIdSchema }), body: projectBodySchema }), updateProject);

export default router;
