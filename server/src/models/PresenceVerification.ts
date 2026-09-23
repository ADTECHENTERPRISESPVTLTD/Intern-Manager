import mongoose, { Document, Schema, Types } from 'mongoose';
import { VerificationStatus } from '../constants';

export interface IPresenceVerification extends Document {
  _id: Types.ObjectId;
  internId: Types.ObjectId;
  sessionId: Types.ObjectId;
  requestedAt: Date;
  expiresAt: Date; // Window to complete this check; after this it is EXPIRED, not answerable
  verifiedAt?: Date;
  status: VerificationStatus;
  attemptsUsed: number; // Failed frame submissions against this check (see VERIFICATION_MAX_ATTEMPTS)
  reason?: string | null; // Why a frame was rejected: NO_FACE | MULTIPLE_FACES | LOW_QUALITY | NO_MATCH | SERVICE_ERROR
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
    expiresAt: {
      type: Date,
      required: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.PENDING,
    },
    attemptsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    reason: {
      type: String,
      default: null,
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
