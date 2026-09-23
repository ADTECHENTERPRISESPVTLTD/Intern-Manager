import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDocument extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  taskId?: Types.ObjectId;
  projectId?: Types.ObjectId;
  resourceUrl: string;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    taskId: {
      type: Schema.Types.ObjectId,
      ref: 'Task',
      default: null,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    resourceUrl: {
      type: String,
      required: [true, 'Resource URL is required'],
      trim: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.index({ taskId: 1 });
documentSchema.index({ projectId: 1 });
documentSchema.index({ uploadedBy: 1 });

export const DocumentModel = mongoose.model<IDocument>(
  'Document',
  documentSchema
);
