import { Request, Response } from 'express';
import { DocumentModel } from '../models/Document';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { UserRole } from '../constants';

export const listDocuments = asyncHandler(async (req: any, res: Response) => {
  const filter = req.user.role === UserRole.ADMIN ? {} : { uploadedBy: req.user._id };
  const docs = await DocumentModel.find(filter).sort({ createdAt: -1 });
  ApiResponse.success(res, docs, 'Resources retrieved');
});

export const createDocument = asyncHandler(async (req: any, res: Response) => {
  const doc = await DocumentModel.create({
    ...req.body,
    uploadedBy: req.user._id,
  });
  ApiResponse.created(res, doc, 'Resource created');
});

export const getDocumentById = asyncHandler(async (req: any, res: Response) => {
  const doc = await DocumentModel.findById(req.params.id);
  if (!doc) throw AppError.notFound('Document not found');

  if (req.user.role !== UserRole.ADMIN && doc.uploadedBy.toString() !== req.user._id.toString()) {
    throw AppError.forbidden('You can only access your own uploaded documents');
  }

  ApiResponse.success(res, doc, 'Document loaded');
});
