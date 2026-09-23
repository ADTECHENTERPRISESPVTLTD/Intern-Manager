import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBreakSession extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  internId: Types.ObjectId;
  breakStartedAt: Date;
  breakEndedAt?: Date;
  breakDuration: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
}

const breakSessionSchema = new Schema<IBreakSession>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'WorkSession',
      required: true,
    },
    internId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    breakStartedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    breakEndedAt: {
      type: Date,
      default: null,
    },
    breakDuration: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

breakSessionSchema.index({ sessionId: 1 });
breakSessionSchema.index({ internId: 1 });

export const BreakSession = mongoose.model<IBreakSession>(
  'BreakSession',
  breakSessionSchema
);
