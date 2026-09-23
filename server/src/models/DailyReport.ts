import mongoose, { Document, Schema, Types } from 'mongoose';
import { ReportStatus } from '../constants';

export interface IDailyReport extends Document {
  _id: Types.ObjectId;
  internId: Types.ObjectId;
  date: Date;
  workSummary: string;
  completedWork: string[];
  learning: string;
  blockers: string[];
  proofLinks: string[];
  submittedAt: Date;
  status: ReportStatus;
  reviewerFeedback?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dailyReportSchema = new Schema<IDailyReport>(
  {
    internId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    workSummary: {
      type: String,
      required: [true, 'Work summary is required'],
    },
    completedWork: {
      type: [String],
      default: [],
    },
    learning: {
      type: String,
      default: '',
    },
    blockers: {
      type: [String],
      default: [],
    },
    proofLinks: {
      type: [String],
      default: [],
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.SUBMITTED,
    },
    reviewerFeedback: {
      type: String,
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique: one daily report per intern per date
dailyReportSchema.index({ internId: 1, date: 1 }, { unique: true });

export const DailyReport = mongoose.model<IDailyReport>(
  'DailyReport',
  dailyReportSchema
);
