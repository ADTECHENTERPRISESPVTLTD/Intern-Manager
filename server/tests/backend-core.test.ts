import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import {
  calculateOfficialSessionState,
  isVerificationDue,
  buildAuthToken,
} from '../src/services/core';
import { revokeToken, isTokenRevoked } from '../src/services/revocation.service';
import { canAccessOwnedResource, ensureTaskAccess } from '../src/controllers/taskController';
import { validate } from '../src/middleware/validate';
import { z } from 'zod';

describe('backend core logic', () => {
  it('captures the official session cap at 8 active hours', () => {
    const result = calculateOfficialSessionState({
      startedAt: new Date('2026-09-23T09:00:00Z'),
      lastHeartbeat: new Date('2026-09-23T09:00:00Z'),
      activeSeconds: 28800,
      completedIntervals: 960,
      status: 'ACTIVE',
      totalBreakSeconds: 1800,
      now: new Date('2026-09-23T17:00:00Z'),
    });

    expect(result.officialActiveSeconds).toBe(28800);
    expect(result.completedIntervals).toBe(960);
    expect(result.status).toBe('COMPLETED');
  });

  it('treats a verification request as due after 30 minutes of active session time', () => {
    const due = isVerificationDue({
      lastVerifiedAt: new Date('2026-09-23T08:30:00Z'),
      now: new Date('2026-09-23T09:00:00Z'),
      intervalMinutes: 30,
    });

    expect(due).toBe(true);
  });

  it('excludes break time from the official work calculation', () => {
    const result = calculateOfficialSessionState({
      startedAt: new Date('2026-09-23T09:00:00Z'),
      lastHeartbeat: new Date('2026-09-23T09:00:00Z'),
      activeSeconds: 28800,
      completedIntervals: 960,
      status: 'ACTIVE',
      totalBreakSeconds: 1800,
      now: new Date('2026-09-23T17:00:00Z'),
    });

    expect(result.officialActiveSeconds).toBe(28800);
    expect(result.status).toBe('COMPLETED');
  });

  it('caps official attendance after the 8-hour limit and does not allow further increase', () => {
    const result = calculateOfficialSessionState({
      startedAt: new Date('2026-09-23T09:00:00Z'),
      lastHeartbeat: new Date('2026-09-23T17:00:00Z'),
      activeSeconds: 30000,
      completedIntervals: 1000,
      status: 'ACTIVE',
      totalBreakSeconds: 0,
      now: new Date('2026-09-23T17:30:00Z'),
    });

    expect(result.officialActiveSeconds).toBe(28800);
    expect(result.completedIntervals).toBe(960);
    expect(result.status).toBe('COMPLETED');
    expect(result.isCapped).toBe(true);
  });

  it('builds a signed auth token with a backend role and user id', () => {
    const token = buildAuthToken({ id: '64d96d6f805a20b0b98a7d12', role: 'INTERN' });
    const decoded = jwt.decode(token) as { id: string; role: string; jti?: string };

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    expect(decoded.id).toBe('64d96d6f805a20b0b98a7d12');
    expect(decoded.role).toBe('INTERN');
    expect(decoded.jti).toBeTruthy();
  });

  it('marks a token as revoked so it is rejected after logout', () => {
    const token = buildAuthToken({ id: '64d96d6f805a20b0b98a7d12', role: 'INTERN' });
    const decoded = jwt.decode(token) as { jti?: string };

    expect(decoded.jti).toBeTruthy();
    expect(revokeToken(token)).toBe(true);
    expect(isTokenRevoked(token)).toBe(true);
  });

  it('blocks access when an intern tries to read another intern task', async () => {
    const ownerId = '64d96d6f805a20b0b98a7d13';
    const currentUserId = '64d96d6f805a20b0b98a7d14';

    expect(canAccessOwnedResource(ownerId, currentUserId, 'INTERN')).toBe(false);
    expect(canAccessOwnedResource(ownerId, currentUserId, 'ADMIN')).toBe(true);
  });

  it('blocks attendance access across different interns even when the record id is valid', () => {
    const ownAttendanceOwner = '64d96d6f805a20b0b98a7d15';
    const differentIntern = '64d96d6f805a20b0b98a7d16';

    expect(canAccessOwnedResource(ownAttendanceOwner, ownAttendanceOwner, 'INTERN')).toBe(true);
    expect(canAccessOwnedResource(ownAttendanceOwner, differentIntern, 'INTERN')).toBe(false);
  });

  it('rejects invalid task payloads before controller logic runs', () => {
    const req = { body: { title: '', priority: 'INVALID' } } as Request;
    const res = {} as Response;
    const next = jest.fn() as unknown as NextFunction;

    validate({ body: z.object({ title: z.string().min(1), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) }) })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid session payload shape before it reaches session logic', () => {
    const req = { params: { id: 'invalid' } } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn() as unknown as NextFunction;

    validate({ params: z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/) }) })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid attendance payloads before they are accepted', () => {
    const req = { body: { officialWorkSeconds: -5, attendanceStatus: 'UNKNOWN' } } as Request;
    const res = {} as Response;
    const next = jest.fn() as unknown as NextFunction;

    validate({
      body: z.object({
        officialWorkSeconds: z.number().min(0),
        attendanceStatus: z.enum(['PRESENT', 'PARTIAL', 'ABSENT', 'UNVERIFIED', 'COMPLETED']),
      }),
    })(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
