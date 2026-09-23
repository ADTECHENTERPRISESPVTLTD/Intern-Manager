import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPerformanceRecord extends Document {
  _id: Types.ObjectId;
  internId: Types.ObjectId;
  period: string; // e.g. "2026-09", "Week 1", etc.
  taskCompletionRate?: number;
  deadlineAdherence?: number;
  attendanceRate?: number;
  sessionCompletionRate?: number;
  dailyReportRate?: number;
  evaluatorNotes?: string;
  evaluatedBy?: Types.ObjectId;
  evaluatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const performanceRecordSchema = new Schema<IPerformanceRecord>(
  {
    internId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    period: {
      type: String,
      required: [true, 'Performance period is required'],
      trim: true,
    },
    taskCompletionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    deadlineAdherence: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    attendanceRate: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    sessionCompletionRate: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    dailyReportRate: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    evaluatorNotes: {
      type: String,
      default: null,
    },
    evaluatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    evaluatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

performanceRecordSchema.index({ internId: 1, period: 1 });

export const PerformanceRecord = mongoose.model<IPerformanceRecord>(
  'PerformanceRecord',
  performanceRecordSchema
);
