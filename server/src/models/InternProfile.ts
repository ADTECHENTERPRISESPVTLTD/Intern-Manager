import mongoose, { Document, Schema, Types } from 'mongoose';
import { InternshipStatus } from '../constants';

export interface IInternProfile extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  designation: string;
  profilePhoto?: string;
  joiningDate: Date;
  internshipDuration: string;
  skills: string[];
  department: string;
  assignedProjects: Types.ObjectId[];
  internshipStatus: InternshipStatus;
  bio?: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const internProfileSchema = new Schema<IInternProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    designation: {
      type: String,
      required: [true, 'Designation is required'],
      trim: true,
    },
    profilePhoto: {
      type: String, // URL to photo
      default: null,
    },
    joiningDate: {
      type: Date,
      required: [true, 'Joining date is required'],
    },
    internshipDuration: {
      type: String,
      default: '3 months',
    },
    skills: {
      type: [String],
      default: [],
    },
    department: {
      type: String,
      default: '',
      trim: true,
    },
    assignedProjects: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Project',
      },
    ],
    internshipStatus: {
      type: String,
      enum: Object.values(InternshipStatus),
      default: InternshipStatus.ACTIVE,
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio must not exceed 500 characters'],
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fast lookups
internProfileSchema.index({ department: 1 });
internProfileSchema.index({ internshipStatus: 1 });

export const InternProfile = mongoose.model<IInternProfile>(
  'InternProfile',
  internProfileSchema
);
