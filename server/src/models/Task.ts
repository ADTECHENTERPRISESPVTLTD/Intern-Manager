import mongoose, { Document, Schema, Types } from 'mongoose';
import { TaskStatus, TaskPriority } from '../constants';

export interface ITask extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  assignedTo?: Types.ObjectId;
  projectId?: Types.ObjectId;
  priority: TaskPriority;
  status: TaskStatus;
  progress: number; // 0-100
  deadline?: Date;
  requirements: string[];
  resources: string[];
  feedback?: string;
  createdBy: Types.ObjectId;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    priority: {
      type: String,
      enum: Object.values(TaskPriority),
      default: TaskPriority.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.NOT_STARTED,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    deadline: {
      type: Date,
    },
    requirements: {
      type: [String],
      default: [],
    },
    resources: {
      type: [String],
      default: [],
    },
    feedback: {
      type: String,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ projectId: 1 });
taskSchema.index({ status: 1 });
taskSchema.index({ createdBy: 1 });

export const Task = mongoose.model<ITask>('Task', taskSchema);
