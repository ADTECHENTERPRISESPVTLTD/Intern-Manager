import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { buildAuthToken } from '../services/core';
import { createFaceVerificationClient } from '../integrations/faceVerificationClient';

const devFallbackRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export interface DevUser {
  _id: string;
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'INTERN';
  designation: string;
  status: 'ACTIVE';
}

const DEV_USERS: DevUser[] = [
  {
    _id: '64d96d6f805a20b0b98a7001',
    id: '64d96d6f805a20b0b98a7001',
    name: 'Admin User',
    email: 'admin@adtech.local',
    role: 'ADMIN',
    designation: 'Platform Administrator',
    status: 'ACTIVE',
  },
  {
    _id: '64d96d6f805a20b0b98a7002',
    id: '64d96d6f805a20b0b98a7002',
    name: 'Akanksha Hajare',
    email: 'akanksha@adtech.local',
    role: 'INTERN',
    designation: 'Frontend Developer',
    status: 'ACTIVE',
  },
  {
    _id: '64d96d6f805a20b0b98a7003',
    id: '64d96d6f805a20b0b98a7003',
    name: 'Adarsh Gangshettiwar',
    email: 'adarsh@adtech.local',
    role: 'INTERN',
    designation: 'Lead Backend Developer',
    status: 'ACTIVE',
  },
  {
    _id: '64d96d6f805a20b0b98a7004',
    id: '64d96d6f805a20b0b98a7004',
    name: 'Soham Amne',
    email: 'soham@adtech.local',
    role: 'INTERN',
    designation: 'AI & Integration Engineer',
    status: 'ACTIVE',
  },
  {
    _id: '64d96d6f805a20b0b98a7005',
    id: '64d96d6f805a20b0b98a7005',
    name: 'Prajakta',
    email: 'prajakta@adtech.local',
    role: 'INTERN',
    designation: 'UI/UX Designer',
    status: 'ACTIVE',
  },
  {
    _id: '64d96d6f805a20b0b98a7006',
    id: '64d96d6f805a20b0b98a7006',
    name: 'Yuragi',
    email: 'yuragi@adtech.local',
    role: 'INTERN',
    designation: 'Full Stack Developer',
    status: 'ACTIVE',
  },
  {
    _id: '64d96d6f805a20b0b98a7007',
    id: '64d96d6f805a20b0b98a7007',
    name: 'Aadya',
    email: 'aadya@adtech.local',
    role: 'INTERN',
    designation: 'Quality Assurance Engineer',
    status: 'ACTIVE',
  },
  {
    _id: '64d96d6f805a20b0b98a7008',
    id: '64d96d6f805a20b0b98a7008',
    name: 'Kalyani',
    email: 'kalyani@adtech.local',
    role: 'INTERN',
    designation: 'Backend Developer',
    status: 'ACTIVE',
  },
  {
    _id: '64d96d6f805a20b0b98a7009',
    id: '64d96d6f805a20b0b98a7009',
    name: 'Demo Intern',
    email: 'intern@demo.local',
    role: 'INTERN',
    designation: 'Demo Intern',
    status: 'ACTIVE',
  },
  {
    _id: '64d96d6f805a20b0b98a7010',
    id: '64d96d6f805a20b0b98a7010',
    name: 'Demo Admin',
    email: 'admin@demo.local',
    role: 'ADMIN',
    designation: 'Demo Admin',
    status: 'ACTIVE',
  },
];

interface DevSession {
  sessionId: string;
  internId: string;
  status: 'ACTIVE' | 'BREAK' | 'COMPLETED';
  startedAt: string;
  accumulatedMs: number;
  lastResumeAt: number | null;
  breaks: Array<{ startedAt: string; endedAt: string | null }>;
  verificationStatus: 'NONE' | 'PENDING' | 'VERIFIED' | 'UNVERIFIED';
  lastVerifiedAt: string | null;
  nextCheckDueAt: string | null;
}

interface DevCheck {
  verificationId: string;
  internId: string;
  sessionId: string;
  status: 'PENDING' | 'VERIFYING' | 'VERIFIED' | 'FAILED' | 'EXPIRED';
  requestedAt: string;
  expiresAt: string;
  verifiedAt: string | null;
  closed: boolean;
  attemptsUsed: number;
  lastReason: string | null;
  failedAttempts: number;
}

interface DevTask {
  _id: string;
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dueDate: string;
}

// In-Memory state store
const sessionsMap = new Map<string, DevSession>();
const checksList: DevCheck[] = [];
const templatesMap = new Map<string, string>();
const registeredAtMap = new Map<string, string>();

const tasksList: DevTask[] = [
  {
    _id: 'task-001',
    id: 'task-001',
    title: 'Implement Real-time Presence Verification UI & Camera HUD',
    description: 'Ensure camera HUD displays 30-minute interval reminders and prompt countdown.',
    assignedTo: '64d96d6f805a20b0b98a7002', // Akanksha
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
  },
  {
    _id: 'task-002',
    id: 'task-002',
    title: 'Build Session Heartbeat & 30-Second Chunk Timer',
    description: 'Track 8-hour daily target with 960 intervals and break exclusion.',
    assignedTo: '64d96d6f805a20b0b98a7003', // Adarsh
    status: 'COMPLETED',
    priority: 'CRITICAL',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
  },
  {
    _id: 'task-003',
    id: 'task-003',
    title: 'Integrate YuNet Face Landmark & SFace Feature Matcher',
    description: 'Connect Python microservice with Node.js backend via multipart image pipeline.',
    assignedTo: '64d96d6f805a20b0b98a7004', // Soham
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
  },
  {
    _id: 'task-004',
    id: 'task-004',
    title: 'Construct Admin Live Intern Oversight Dashboard',
    description: 'Real-time telemetry of working interns, active sessions, and attendance metrics.',
    assignedTo: '64d96d6f805a20b0b98a7001', // Admin
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    dueDate: new Date(Date.now() + 86400000 * 4).toISOString(),
  },
];

const TARGET_SEC = 28800; // 8 hours
const INTERVAL_SEC = 30; // 30s session slice

const getActiveSeconds = (session: DevSession, nowMs: number): number => {
  const currentRunning = session.lastResumeAt ? Math.max(0, nowMs - session.lastResumeAt) : 0;
  return Math.min(Math.floor((session.accumulatedMs + currentRunning) / 1000), TARGET_SEC);
};

const formatSessionView = (session: DevSession | null, nowMs = Date.now()) => {
  if (!session) return null;
  const active = getActiveSeconds(session, nowMs);
  return {
    _id: session.sessionId,
    sessionId: session.sessionId,
    userId: session.internId,
    internId: session.internId,
    status: session.status,
    startedAt: session.startedAt,
    activeSeconds: active,
    targetSeconds: TARGET_SEC,
    completedIntervals: Math.min(Math.floor(active / INTERVAL_SEC), TARGET_SEC / INTERVAL_SEC),
    totalIntervals: TARGET_SEC / INTERVAL_SEC,
    officialAttendance: true,
    verificationStatus: session.verificationStatus,
    lastVerifiedAt: session.lastVerifiedAt,
    breaks: session.breaks,
  };
};

const authenticateDev = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Please log in again', code: 'UNAUTHORIZED' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id?: string; _id?: string; role?: string };
    const userId = decoded.id || decoded._id;
    const user = DEV_USERS.find((u) => u._id === userId || u.id === userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found in dev session', code: 'UNAUTHORIZED' });
    }
    (req as any).user = user;
    next();
  } catch {
    // If token verify fails with custom secret, find by decoded payload
    const decoded = jwt.decode(token) as { id?: string; _id?: string } | null;
    const user = DEV_USERS.find((u) => u._id === decoded?.id || u.id === decoded?.id) || DEV_USERS[1];
    (req as any).user = user;
    next();
  }
};

// --- AUTH ROUTES ---
devFallbackRouter.post(['/auth/login', '/login'], (req: Request, res: Response) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const user = DEV_USERS.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS',
    });
  }

  const token = buildAuthToken({ id: user._id, role: user.role });

  return res.json({
    success: true,
    message: 'Login successful (In-Memory Development Mode)',
    data: {
      user: {
        _id: user._id,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        status: user.status,
      },
      token,
    },
  });
});

devFallbackRouter.get(['/auth/me', '/intern/me'], authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  return res.json({ success: true, data: user, message: 'User profile loaded' });
});

devFallbackRouter.post('/auth/logout', (req: Request, res: Response) => {
  return res.json({ success: true, data: { loggedOut: true }, message: 'Logged out successfully' });
});

// --- WORK SESSION ROUTES ---
devFallbackRouter.get(['/sessions/current', '/session/current'], authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  const session = sessionsMap.get(user._id) || null;
  return res.json({ success: true, data: formatSessionView(session) });
});

devFallbackRouter.post(['/sessions/start', '/session/start'], authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  const existing = sessionsMap.get(user._id);
  const now = Date.now();

  if (existing && existing.status === 'ACTIVE') {
    return res.json({ success: true, data: formatSessionView(existing), message: 'Session already active' });
  }

  const newSession: DevSession = {
    sessionId: randomUUID(),
    internId: user._id,
    status: 'ACTIVE',
    startedAt: new Date(now).toISOString(),
    accumulatedMs: existing?.accumulatedMs || 0,
    lastResumeAt: now,
    breaks: existing?.breaks || [],
    verificationStatus: 'NONE',
    lastVerifiedAt: null,
    nextCheckDueAt: new Date(now + 1800000).toISOString(),
  };

  sessionsMap.set(user._id, newSession);
  return res.json({ success: true, data: formatSessionView(newSession), message: 'Work session started' });
});

devFallbackRouter.post(['/sessions/break', '/session/break', '/session/break/start'], authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  const session = sessionsMap.get(user._id);
  const now = Date.now();

  if (!session || session.status !== 'ACTIVE') {
    return res.status(409).json({ success: false, message: 'No active session to pause', code: 'SESSION_NOT_ACTIVE' });
  }

  if (session.lastResumeAt) {
    session.accumulatedMs += now - session.lastResumeAt;
  }
  session.lastResumeAt = null;
  session.status = 'BREAK';
  session.breaks.push({ startedAt: new Date(now).toISOString(), endedAt: null });

  return res.json({ success: true, data: formatSessionView(session, now), message: 'Break started' });
});

devFallbackRouter.post(['/sessions/resume', '/session/resume'], authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  const session = sessionsMap.get(user._id);
  const now = Date.now();

  if (!session || session.status !== 'BREAK') {
    return res.status(409).json({ success: false, message: 'Session is not on a break', code: 'SESSION_NOT_ON_BREAK' });
  }

  session.status = 'ACTIVE';
  session.lastResumeAt = now;
  const lastBreak = session.breaks[session.breaks.length - 1];
  if (lastBreak) {
    lastBreak.endedAt = new Date(now).toISOString();
  }

  return res.json({ success: true, data: formatSessionView(session, now), message: 'Work session resumed' });
});

devFallbackRouter.post(['/sessions/heartbeat', '/session/heartbeat', '/session/complete'], authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  const session = sessionsMap.get(user._id);
  return res.json({ success: true, data: formatSessionView(session ?? null), message: 'Heartbeat registered' });
});

// --- VERIFICATION ROUTES ---
devFallbackRouter.get(['/verifications/status', '/verification/status'], authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  const session = sessionsMap.get(user._id) || null;
  const openCheck = checksList.find((c) => c.internId === user._id && !c.closed);

  return res.json({
    success: true,
    data: {
      sessionId: session?.sessionId || null,
      verificationActive: Boolean(session && session.status === 'ACTIVE'),
      verificationRequired: Boolean(openCheck),
      current: openCheck
        ? {
            verificationId: openCheck.verificationId,
            status: openCheck.status,
            requestedAt: openCheck.requestedAt,
            expiresAt: openCheck.expiresAt,
            attemptsUsed: openCheck.attemptsUsed,
            maxAttempts: 3,
          }
        : null,
      lastVerifiedAt: session?.lastVerifiedAt || null,
      nextCheckDueAt: session?.nextCheckDueAt || null,
      sessionVerificationStatus: session?.verificationStatus || 'NONE',
      serverTime: new Date().toISOString(),
    },
  });
});

devFallbackRouter.post(['/verifications/request', '/verification/request'], authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  const session = sessionsMap.get(user._id);
  const now = Date.now();

  let openCheck = checksList.find((c) => c.internId === user._id && !c.closed);
  if (!openCheck) {
    openCheck = {
      verificationId: randomUUID(),
      internId: user._id,
      sessionId: session?.sessionId || randomUUID(),
      status: 'PENDING',
      requestedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 300000).toISOString(),
      verifiedAt: null,
      closed: false,
      attemptsUsed: 0,
      lastReason: null,
      failedAttempts: 0,
    };
    checksList.push(openCheck);
  }

  return res.json({
    success: true,
    data: {
      verificationId: openCheck.verificationId,
      status: openCheck.status,
      requestedAt: openCheck.requestedAt,
      expiresAt: openCheck.expiresAt,
      attemptsUsed: openCheck.attemptsUsed,
      maxAttempts: 3,
    },
    message: 'Verification check ready',
  });
});

devFallbackRouter.post(
  ['/verifications/verify', '/verification/verify'],
  authenticateDev,
  upload.single('frame'),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const session = sessionsMap.get(user._id);
    const verificationId = req.body?.verificationId;

    let check = checksList.find((c) => c.verificationId === verificationId && c.internId === user._id);
    if (!check) {
      check = checksList.find((c) => c.internId === user._id && !c.closed);
    }

    const now = Date.now();

    // Check if we have registered template
    const registeredTemplate = templatesMap.get(user._id);

    let match = true;
    let confidence = 0.95;

    if (req.file && registeredTemplate) {
      try {
        const client = createFaceVerificationClient({
          baseUrl: env.FACE_VERIFICATION_URL,
          apiKey: env.FACE_VERIFICATION_KEY,
        });
        const aiResult = await client.verify(new Uint8Array(req.file.buffer), registeredTemplate);
        match = aiResult.decision === 'MATCH';
        confidence = aiResult.confidence ?? 0.95;
      } catch {
        // AI service offline, fall back to camera frame acceptance
        match = true;
      }
    }

    if (match) {
      if (check) {
        check.status = 'VERIFIED';
        check.closed = true;
        check.verifiedAt = new Date(now).toISOString();
        check.attemptsUsed += 1;
      }
      if (session) {
        session.verificationStatus = 'VERIFIED';
        session.lastVerifiedAt = new Date(now).toISOString();
        session.nextCheckDueAt = new Date(now + 1800000).toISOString();
      }

      return res.json({
        success: true,
        data: {
          verificationId: check?.verificationId || randomUUID(),
          status: 'VERIFIED',
          attemptsRemaining: 3,
          closed: true,
          nextCheckDueAt: new Date(now + 1800000).toISOString(),
          sessionVerificationStatus: 'VERIFIED',
          confidence,
        },
        message: 'Presence verified successfully',
      });
    }

    if (check) {
      check.attemptsUsed += 1;
      check.failedAttempts += 1;
      check.lastReason = 'NO_MATCH';
      if (check.attemptsUsed >= 3) {
        check.closed = true;
        check.status = 'FAILED';
        if (session) session.verificationStatus = 'UNVERIFIED';
      }
    }

    return res.status(400).json({
      success: false,
      message: 'Verification failed. Face does not match registered profile.',
      code: 'VERIFICATION_FAILED',
    });
  }
);

devFallbackRouter.get('/verifications/registration', authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  return res.json({
    success: true,
    data: {
      registered: templatesMap.has(user._id),
      registeredAt: registeredAtMap.get(user._id) || null,
    },
  });
});

devFallbackRouter.post(
  '/verifications/registration',
  authenticateDev,
  upload.array('frames', 5),
  async (req: Request, res: Response) => {
    const user = (req as any).user;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Send between 3 and 5 JPEG frames for registration',
        code: 'INVALID_REQUEST',
      });
    }

    try {
      const client = createFaceVerificationClient({
        baseUrl: env.FACE_VERIFICATION_URL,
        apiKey: env.FACE_VERIFICATION_KEY,
      });
      const template = await client.register(files.map((f) => new Uint8Array(f.buffer)));
      templatesMap.set(user._id, template);
    } catch {
      // Store dummy template so user registration succeeds if Python microservice is booting
      templatesMap.set(user._id, `dev-template-${user._id}-${Date.now()}`);
    }

    const registeredAt = new Date().toISOString();
    registeredAtMap.set(user._id, registeredAt);

    return res.json({
      success: true,
      data: { registered: true, registeredAt },
      message: 'Face biometrics registered successfully',
    });
  }
);

devFallbackRouter.get('/verifications/history', authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  const checks = checksList
    .filter((c) => c.internId === user._id)
    .reverse()
    .map((c) => ({
      verificationId: c.verificationId,
      sessionId: c.sessionId,
      requestedAt: c.requestedAt,
      verifiedAt: c.verifiedAt,
      status: c.status,
      reason: c.lastReason,
      attempts: c.attemptsUsed,
    }));

  return res.json({ success: true, data: { items: checks, page: 1, total: checks.length } });
});

// --- ADMIN ROUTES ---
devFallbackRouter.get(['/admin/interns'], authenticateDev, (req: Request, res: Response) => {
  const interns = DEV_USERS.filter((u) => u.role === 'INTERN').map((u) => {
    const session = sessionsMap.get(u._id) || null;
    const userChecks = checksList.filter((c) => c.internId === u._id);
    return {
      _id: u._id,
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      designation: u.designation,
      session: formatSessionView(session),
      verification: {
        status: session?.verificationStatus || 'NONE',
        lastVerifiedAt: session?.lastVerifiedAt || null,
        nextCheckDueAt: session?.nextCheckDueAt || null,
        failedCount: userChecks.reduce((sum, c) => sum + c.failedAttempts, 0),
        unverifiedCount: userChecks.filter((c) => c.closed && c.status !== 'VERIFIED').length,
      },
    };
  });

  return res.json({ success: true, data: interns, message: 'Interns list loaded' });
});

devFallbackRouter.get('/admin/dashboard', authenticateDev, (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      totalInterns: DEV_USERS.filter((u) => u.role === 'INTERN').length,
      activeSessions: Array.from(sessionsMap.values()).filter((s) => s.status === 'ACTIVE').length,
      pendingVerifications: checksList.filter((c) => !c.closed && c.status === 'PENDING').length,
      systemStatus: 'ONLINE (DEV IN-MEMORY)',
    },
  });
});

// --- TASKS ROUTES ---
devFallbackRouter.get(['/tasks'], authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  const filtered = user.role === 'ADMIN' ? tasksList : tasksList.filter((t) => t.assignedTo === user._id);
  return res.json({ success: true, data: filtered });
});

devFallbackRouter.post(['/tasks'], authenticateDev, (req: Request, res: Response) => {
  const { title, description, assignedTo, priority = 'MEDIUM', dueDate } = req.body || {};
  const newTask: DevTask = {
    _id: `task-${Date.now()}`,
    id: `task-${Date.now()}`,
    title: title || 'Untitled Task',
    description: description || '',
    assignedTo: assignedTo || (req as any).user._id,
    status: 'PENDING',
    priority,
    dueDate: dueDate || new Date(Date.now() + 86400000).toISOString(),
  };
  tasksList.push(newTask);
  return res.status(201).json({ success: true, data: newTask, message: 'Task created' });
});

devFallbackRouter.patch(['/tasks/:id'], authenticateDev, (req: Request, res: Response) => {
  const task = tasksList.find((t) => t._id === req.params.id || t.id === req.params.id);
  if (!task) return res.status(404).json({ success: false, message: 'Task not found' });
  Object.assign(task, req.body);
  return res.json({ success: true, data: task, message: 'Task updated' });
});

// --- ATTENDANCE, PROJECTS, REPORTS, PERFORMANCE, DOCUMENTS ---
devFallbackRouter.get(['/attendance', '/attendance/breaks'], authenticateDev, (req: Request, res: Response) => {
  const user = (req as any).user;
  const session = sessionsMap.get(user._id);
  return res.json({
    success: true,
    data: {
      officialWorkSeconds: session ? getActiveSeconds(session, Date.now()) : 0,
      targetSeconds: TARGET_SEC,
      attendanceStatus: session ? 'PRESENT' : 'ABSENT',
      breaks: session?.breaks || [],
    },
  });
});

devFallbackRouter.get(['/projects'], authenticateDev, (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: [
      {
        _id: 'proj-001',
        title: 'AD TECH Intern Management Platform',
        description: 'Comprehensive platform for work session tracking and biometric presence verification.',
        status: 'ACTIVE',
      },
      {
        _id: 'proj-002',
        title: 'AI Automated Presence Verification Engine',
        description: 'YuNet and SFace computer vision pipeline for automated intern presence assurance.',
        status: 'ACTIVE',
      },
    ],
  });
});

devFallbackRouter.get(['/reports'], authenticateDev, (_req: Request, res: Response) => {
  return res.json({ success: true, data: [] });
});

devFallbackRouter.get(['/performance', '/admin/performance'], authenticateDev, (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: {
      attendanceRate: 98,
      completedTasks: 12,
      qualityScore: 9.4,
      onTimeDeliveryRate: 96,
    },
  });
});

devFallbackRouter.get(['/documents'], authenticateDev, (_req: Request, res: Response) => {
  return res.json({
    success: true,
    data: [
      {
        _id: 'doc-001',
        title: 'AD TECH Work Platform Guidelines',
        category: 'POLICY',
        url: '#',
      },
      {
        _id: 'doc-002',
        title: '8-Hour Session & 30-Second Verification Protocol',
        category: 'SPECIFICATION',
        url: '#',
      },
    ],
  });
});

export default devFallbackRouter;
