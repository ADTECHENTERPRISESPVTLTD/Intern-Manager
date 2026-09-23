import app from './src/app';
import { connectDatabase } from './src/config/database';
import { env } from './src/config/env';

// env.ts falls back to well-known placeholder secrets (e.g. 'dev_local_jwt_secret_change_me')
// when JWT_SECRET / JWT_REFRESH_SECRET aren't set, so local dev works without a .env file.
// Those placeholders are in the public repo, so anyone could forge a valid admin JWT with them
// - refuse to boot with production traffic on secrets an attacker can already read.
const INSECURE_DEFAULTS = new Set(['dev_local_jwt_secret_change_me', 'dev_local_refresh_secret_change_me', 'development-placeholder']);

const assertProductionSecretsAreSet = (): void => {
  if (env.NODE_ENV !== 'production') return;
  if (INSECURE_DEFAULTS.has(env.JWT_SECRET) || INSECURE_DEFAULTS.has(env.JWT_REFRESH_SECRET)) {
    console.error('Refusing to start: JWT_SECRET / JWT_REFRESH_SECRET must be set to real secrets in production.');
    process.exit(1);
  }
};

const startServer = async (): Promise<void> => {
  try {
    assertProductionSecretsAreSet();
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
