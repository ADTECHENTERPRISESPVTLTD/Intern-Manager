import mongoose from 'mongoose';
import { env } from './env';

export const isDatabaseConnected = (): boolean => mongoose.connection.readyState === 1;

export const connectDatabase = async (): Promise<boolean> => {
  try {
    const conn = await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 2500,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return true;
  } catch (error: any) {
    console.warn(`⚠️ MongoDB connection unavailable (${error?.message || error}).`);
    console.warn(`⚡ Starting AD TECH Backend in resilient In-Memory Development Mode on port ${env.PORT}.`);
    return false;
  }

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });
};

export const disconnectDatabase = async (): Promise<void> => {
  if (isDatabaseConnected()) {
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  }
};

