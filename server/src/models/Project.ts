import mongoose, { Document, Schema, Types } from 'mongoose';
import { ProjectStatus } from '../constants';

export interface IProject extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  team: Types.ObjectId[];
  technologyStack: string[];
  status: ProjectStatus;
  repository?: string;
  deploymentUrl?: string;
  startDate?: Date;
  endDate?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    team: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    technologyStack: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.PLANNING,
    },
    repository: {
      type: String,
      trim: true,
    },
    deploymentUrl: {
      type: String,
      trim: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

projectSchema.index({ status: 1 });
projectSchema.index({ team: 1 });

export const Project = mongoose.model<IProject>('Project', projectSchema);
