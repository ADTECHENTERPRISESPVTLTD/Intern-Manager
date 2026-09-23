import { AuditLog } from '../models/AuditLog';
import { AuditAction } from '../constants';

export const writeAuditLog = async ({
  actor,
  action,
  target,
  targetType,
  metadata,
}: {
  actor: string | any;
  action: AuditAction;
  target?: string | any;
  targetType?: string;
  metadata?: Record<string, any>;
}) => {
  return AuditLog.create({
    actor,
    action,
    target,
    targetType,
    metadata: metadata || {},
    timestamp: new Date(),
  });
};
