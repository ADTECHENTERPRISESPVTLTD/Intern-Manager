import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { createDocument, getDocumentById, listDocuments } from '../controllers/documentController';
import { validate } from '../middleware/validate';
import { mongoIdSchema } from '../validators/common.validator';

const documentBodySchema = z.object({
  title: z.string().min(1).trim(),
  description: z.string().optional(),
  taskId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
  projectId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional().nullable(),
  resourceUrl: z.string().url(),
});

const router = Router();
router.use(authenticate);
router.get('/', listDocuments);
router.post('/', validate({ body: documentBodySchema }), createDocument);
router.get('/:id', validate({ params: z.object({ id: mongoIdSchema }) }), getDocumentById);

export default router;
