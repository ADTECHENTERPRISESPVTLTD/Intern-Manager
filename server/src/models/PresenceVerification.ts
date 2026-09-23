import mongoose, { Document, Schema, Types } from 'mongoose';
import { VerificationStatus } from '../constants';

export interface IPresenceVerification extends Document {
  _id: Types.ObjectId;
  internId: Types.ObjectId;
  sessionId: Types.ObjectId;
  requestedAt: Date;
  verifiedAt?: Date;
  expiresAt?: Date;
  closed?: boolean;
  closedAt?: Date;
  attemptsUsed?: number;
  lastReason?: string | null;
  failedAttempts?: number;
  status: VerificationStatus;
  provider?: string; // Reference to verification service
  externalReference?: string; // External verification ID
  createdAt: Date;
  updatedAt: Date;
}

const presenceVerificationSchema = new Schema<IPresenceVerification>(
  {
    internId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'WorkSession',
      required: true,
    },
    requestedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    closed: {
      type: Boolean,
      default: false,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    attemptsUsed: {
      type: Number,
      default: 0,
    },
    lastReason: {
      type: String,
      default: null,
    },
    failedAttempts: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.PENDING,
    },
    provider: {
      type: String,
      default: null,
    },
    externalReference: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


presenceVerificationSchema.index({ internId: 1, sessionId: 1 });
presenceVerificationSchema.index({ status: 1 });

export const PresenceVerification = mongoose.model<IPresenceVerification>(
  'PresenceVerification',
  presenceVerificationSchema
);
