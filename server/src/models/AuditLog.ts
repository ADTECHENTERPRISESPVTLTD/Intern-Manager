import mongoose, { Document, Schema, Types } from 'mongoose';
import { AuditAction } from '../constants';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actor: Types.ObjectId;
  action: AuditAction;
  target?: Types.ObjectId;
  targetType?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: true,
    },
    target: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    targetType: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ target: 1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
