import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { createIntern, getMyProfile, listInterns, updateMyProfile } from '../controllers/internController';
import { UserRole } from '../constants';
import { validate } from '../middleware/validate';
import { updateProfileSchema, createInternSchema } from '../validators/intern.validator';

const router = Router();

router.use(authenticate);
router.get('/me', getMyProfile);
router.put('/me', validate({ body: updateProfileSchema }), updateMyProfile);
router.get('/', authorize(UserRole.ADMIN), listInterns);
router.post('/', authorize(UserRole.ADMIN), validate({ body: createInternSchema }), createIntern);

export default router;
