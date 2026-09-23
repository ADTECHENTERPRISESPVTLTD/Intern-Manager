import mongoose, { Document, Schema, Types } from 'mongoose';
import { SessionStatus } from '../constants';

export interface IWorkSession extends Document {
  _id: Types.ObjectId;
  internId: Types.ObjectId;
  startedAt: Date;
  endedAt?: Date;
  lastHeartbeat: Date;
  status: SessionStatus;
  activeSeconds: number; // Server-calculated official active time
  completedIntervals: number; // Number of completed 30-second intervals
  totalBreakSeconds: number; // Total break time in seconds
  isOfficial: boolean; // Whether this counts for official attendance
  createdAt: Date;
  updatedAt: Date;
}

const workSessionSchema = new Schema<IWorkSession>(
  {
    internId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    lastHeartbeat: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.ACTIVE,
    },
    activeSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedIntervals: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalBreakSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    isOfficial: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

workSessionSchema.index({ internId: 1, status: 1 });
workSessionSchema.index({ internId: 1, startedAt: -1 });
workSessionSchema.index({ status: 1 });

export const WorkSession = mongoose.model<IWorkSession>(
  'WorkSession',
  workSessionSchema
);
