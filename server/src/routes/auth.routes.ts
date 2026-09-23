import { Router } from 'express';
import { login, logout, register, getCurrentUser } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema } from '../validators/auth.validator';

const router = Router();

router.post('/register', validate({ body: registerSchema }), register);
router.post('/login', validate({ body: loginSchema }), login);
router.get('/me', authenticate, getCurrentUser);
router.post('/logout', authenticate, logout);

export default router;
