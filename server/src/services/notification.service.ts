import { Notification } from '../models/Notification';
import { NotificationType } from '../constants';

export const createNotification = async ({
  recipientId,
  type,
  title,
  message,
  referenceId,
  referenceType,
}: {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: string;
}) => {
  return Notification.create({
    recipientId,
    type,
    title,
    message,
    referenceId,
    referenceType,
    isRead: false,
  });
};

export const getUserNotifications = async (recipientId: string) => {
  return Notification.find({ recipientId }).sort({ createdAt: -1 });
};
