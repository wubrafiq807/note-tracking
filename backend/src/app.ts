import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createAuthService } from './services/auth.service.js';
import { createRoutes } from './routes.js';
import { limiter, errorHandler } from './middleware/index.js';

interface AppOptions { jwtSecret?: string; enableRateLimit?: boolean; frontendOrigin?: string; trustProxy?: false | 'loopback' }
export function createApp({ jwtSecret, enableRateLimit = true, frontendOrigin = 'http://localhost:5173', trustProxy = false }: AppOptions = {}) {
  const authService = createAuthService(jwtSecret);
  const app = express();
  app.disable('x-powered-by');
  // Only the local reverse proxy may supply the original client IP in production.
  if (trustProxy) app.set('trust proxy', trustProxy);
  app.use(helmet());
  app.use(cors({ origin: frontendOrigin, methods: ['GET', 'POST', 'PATCH', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '64kb' }));
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  if (enableRateLimit) app.use('/api', limiter(60000, 300));
  app.use('/api', createRoutes(authService, enableRateLimit));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.use(errorHandler);
  return app;
}
