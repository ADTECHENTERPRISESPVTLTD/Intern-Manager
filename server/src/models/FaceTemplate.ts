import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * One encrypted face template per intern. The value comes back opaque from the
 * face-verification service (see ai-service/README.md) — this backend never decodes
 * or inspects it, only stores and forwards it. It is never returned to the frontend
 * (select: false), matching how `password` is handled on User.
 */
export interface IFaceTemplate extends Document {
  _id: Types.ObjectId;
  internId: Types.ObjectId;
  encryptedTemplate: string;
  registeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const faceTemplateSchema = new Schema<IFaceTemplate>(
  {
    internId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    encryptedTemplate: {
      type: String,
      required: [true, 'Encrypted template is required'],
      select: false,
    },
    registeredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const FaceTemplate = mongoose.model<IFaceTemplate>('FaceTemplate', faceTemplateSchema);
