import { Router, Request, Response } from 'express';
import {
  getCaptchaConfig,
  updateCaptchaConfig,
  generateChallenge,
  verifyCaptcha,
  getCaptchaStatistics,
} from '../services/captchaService';
import { requireAuth, isUserAdmin, AuthRequest } from '../middleware/authMiddleware';

export const captchaRouter = Router();

/**
 * Public endpoint: Retrieve CAPTCHA configuration for clients
 */
captchaRouter.get('/config', (req: Request, res: Response) => {
  const config = getCaptchaConfig();
  res.json({
    enabled: config.enabled,
    mode: config.mode,
    siteKey: config.siteKey,
    projectId: config.projectId,
    thresholdScore: config.thresholdScore,
    enforcedActions: config.enforcedActions,
  });
});

/**
 * Public endpoint: Request a real-time cryptographic visual/math challenge
 */
captchaRouter.get('/challenge', (req: Request, res: Response) => {
  const action = (req.query.action as string) || 'GENERAL';
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
  const challenge = generateChallenge(action, clientIp);

  res.json({
    token: challenge.token,
    challengeId: challenge.challengeId,
    question: challenge.question,
    visualCode: challenge.visualCode,
    expiresAt: challenge.expiresAt,
  });
});

/**
 * Public endpoint: Verify token
 */
captchaRouter.post('/verify', async (req: Request, res: Response) => {
  const { token, action = 'GENERAL', answer, visualCode } = req.body;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
  const userId = (req as any).user?.id;

  const result = await verifyCaptcha(token, action, clientIp, { answer, visualCode, userId });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: 'CAPTCHA verification failed.',
      result,
    });
  }

  res.json({
    success: true,
    verificationToken: `PHX_CAPTCHA_VERIFIED_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    result,
  });
});

/**
 * Admin endpoint: Real-time telemetry statistics & audit logs
 */
captchaRouter.get('/admin/stats', requireAuth, async (req: AuthRequest, res: Response) => {
  const isAdmin = isUserAdmin(req.user);
  if (!isAdmin) {
    return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS', message: 'Admin permissions required.' });
  }

  const stats = await getCaptchaStatistics();
  res.json(stats);
});

/**
 * Admin endpoint: Update CAPTCHA configuration & enforcement toggles
 */
captchaRouter.post('/admin/config', requireAuth, async (req: AuthRequest, res: Response) => {
  const isAdmin = isUserAdmin(req.user);
  if (!isAdmin) {
    return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS', message: 'Admin permissions required.' });
  }

  const updated = await updateCaptchaConfig(req.body);
  res.json({
    success: true,
    message: 'CAPTCHA security configuration updated successfully.',
    config: updated,
  });
});

/**
 * Admin endpoint: Simulate and test challenge
 */
captchaRouter.post('/admin/test', requireAuth, async (req: AuthRequest, res: Response) => {
  const isAdmin = isUserAdmin(req.user);
  if (!isAdmin) {
    return res.status(403).json({ error: 'UNAUTHORIZED_ACCESS', message: 'Admin permissions required.' });
  }

  const challenge = generateChallenge('ADMIN_SIMULATION', '127.0.0.1');
  res.json({
    success: true,
    message: 'Simulated challenge generated successfully.',
    challenge,
  });
});
