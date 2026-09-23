import app from './src/app';
import { connectDatabase } from './src/config/database';
import { env } from './src/config/env';

const startServer = async (): Promise<void> => {
  try {
    await connectDatabase();
    app.listen(env.PORT, () => {
      console.log(`🚀 Server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
};

startServer();
