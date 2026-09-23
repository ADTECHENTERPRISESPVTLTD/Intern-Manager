import mongoose, { Document, Schema, Types } from 'mongoose';
import { SubmissionStatus } from '../constants';

export interface ISubmissionLink {
  type: 'github' | 'deployment' | 'document' | 'video' | 'other';
  url: string;
  label?: string;
}

export interface ITaskSubmission extends Document {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  submittedBy: Types.ObjectId;
  links: ISubmissionLink[];
  notes?: string;
  status: SubmissionStatus;
  reviewer?: Types.ObjectId;
  feedback?: string;
  reviewedAt?: Date;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const submissionLinkSchema = new Schema<ISubmissionLink>(
  {
    type: {
      type: String,
      enum: ['github', 'deployment', 'document', 'video', 'other'],
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const taskSubmissionSchema = new Schema<ITaskSubmission>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      required: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    links: {
      type: [submissionLinkSchema],
      default: [],
    },
    notes: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(SubmissionStatus),
      default: SubmissionStatus.SUBMITTED,
    },
    reviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    feedback: {
      type: String,
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

taskSubmissionSchema.index({ taskId: 1 });
taskSubmissionSchema.index({ submittedBy: 1 });

export const TaskSubmission = mongoose.model<ITaskSubmission>(
  'TaskSubmission',
  taskSubmissionSchema
);
