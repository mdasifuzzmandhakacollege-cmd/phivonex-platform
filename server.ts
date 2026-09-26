import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import authRouter from './src/server/routes/authRoutes';
import referralRouter from './src/server/routes/referralRoutes';
import userRouter from './src/server/routes/userRoutes';
import nodeRouter from './src/server/routes/nodeRoutes';
import orderRouter from './src/server/routes/orderRoutes';
import commissionRouter from './src/server/routes/commissionRoutes';
import networkRouter from './src/server/routes/networkRoutes';
import matchingRouter from './src/server/routes/matchingRoutes';
import { promotionRouter } from './src/server/routes/promotionRoutes';
import { walletRouter } from './src/server/routes/walletRoutes';
import { rewardRouter } from './src/server/routes/rewardRoutes';
import { publicNetworkRouter } from './src/server/routes/publicNetworkRoutes';
import { withdrawalRouter } from './src/server/routes/withdrawalRoutes';
import { adminRouter } from './src/server/routes/adminRoutes';
import { depositRouter } from './src/server/routes/depositRoutes';
import { economicRouter } from './src/server/routes/economicRoutes';
import { swapRouter } from './src/server/routes/swapRoutes';
import { notificationRouter } from './src/server/routes/notificationRoutes';
import { emailWebhookRouter } from './src/server/routes/emailWebhookRoutes';
import { getDb } from './src/server/db/db';
import { startMatchingScheduler } from './src/server/services/binaryMatchingScheduler';
import {
  securityHeadersMiddleware,
  csrfOriginProtection,
  sanitizeProductionErrors,
} from './src/server/middleware/securityMiddleware';
import { validateProductionConfig } from './src/config/integrationConfig';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Fail-closed validation for production configuration
  try {
    validateProductionConfig();
  } catch (configErr) {
    console.error('[Server Startup Fatal Error]', configErr);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // 1. Security Headers (CSP, X-Content-Type-Options, Frame Protection)
  app.use(securityHeadersMiddleware);

  // 2. Body and cookie parsing with payload limit
  app.use(express.json({
    limit: '1mb',
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString('utf-8');
    }
  }));
  app.use(cookieParser());

  // 3. CSRF & untrusted origin protection for state-changing operations
  app.use('/api', csrfOriginProtection);

  // Initialize Database Schema prior to accepting traffic
  try {
    await getDb();
    console.log('[Server] Database and referral migrations initialized.');
    startMatchingScheduler();
  } catch (err) {
    console.error('[Server] Failed to initialize database on startup:', err);
  }

  // Database readiness middleware for all API requests
  app.use(async (req, res, next) => {
    if (req.path.startsWith('/api/') && req.path !== '/api/health') {
      try {
        await getDb();
        next();
      } catch (dbErr) {
        console.error(`[Server] Database unavailable on ${req.method} ${req.path}:`, dbErr);
        res.status(503).json({
          error: 'DATABASE_UNAVAILABLE',
          message: 'Database is currently initializing. Please retry in a few moments.',
        });
        return;
      }
    } else {
      next();
    }
  });

  // Mount API routes
  app.use('/api/auth', authRouter);
  app.use('/api/referrals', referralRouter);
  app.use('/api/users', userRouter);
  app.use('/api/nodes', nodeRouter);
  app.use('/api/node-orders', orderRouter);
  app.use('/api/referral-commissions', commissionRouter);
  app.use('/api/network', networkRouter);
  app.use('/api/matching', matchingRouter);
  app.use('/api/promotions', promotionRouter);
  app.use('/api/wallet', walletRouter);
  app.use('/api/rewards', rewardRouter);
  app.use('/api/public/network', publicNetworkRouter);
  app.use('/api/withdrawals', withdrawalRouter);
  app.use('/api/deposits', depositRouter);
  app.use('/api/swap', swapRouter);
  app.use('/api/notifications', notificationRouter);
  app.use('/api/admin/economics', economicRouter);
  app.use('/api/webhooks/email', emailWebhookRouter);
  app.use('/api/admin', adminRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Centralized Error Sanitization Middleware for API routes
  app.use('/api', sanitizeProductionErrors);

  // Vite middleware in dev, static files in production
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PHIVONEX Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[PHIVONEX Server Error]', err);
  process.exit(1);
});
