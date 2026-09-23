import mongoose, { Document, Schema, Types } from 'mongoose';
import { AttendanceStatus, VerificationStatus } from '../constants';

export interface IAttendance extends Document {
  _id: Types.ObjectId;
  internId: Types.ObjectId;
  date: Date;
  sessionId?: Types.ObjectId;
  officialWorkSeconds: number;
  completedIntervals: number;
  breakSeconds: number;
  verificationStatus: VerificationStatus;
  attendanceStatus: AttendanceStatus;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
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
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'WorkSession',
      default: null,
    },
    officialWorkSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedIntervals: {
      type: Number,
      default: 0,
      min: 0,
    },
    breakSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    verificationStatus: {
      type: String,
      enum: Object.values(VerificationStatus),
      default: VerificationStatus.PENDING,
    },
    attendanceStatus: {
      type: String,
      enum: Object.values(AttendanceStatus),
      default: AttendanceStatus.ABSENT,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index: one attendance record per intern per date
attendanceSchema.index({ internId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });
attendanceSchema.index({ attendanceStatus: 1 });

export const Attendance = mongoose.model<IAttendance>(
  'Attendance',
  attendanceSchema
);
