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
import { getDb } from './src/server/db/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Body and cookie parsing
  app.use(express.json());
  app.use(cookieParser());

  // Initialize Database Schema prior to accepting traffic
  try {
    await getDb();
    console.log('[Server] Database and referral migrations initialized.');
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

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

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
    const distPath = path.resolve(__dirname, 'dist');
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
