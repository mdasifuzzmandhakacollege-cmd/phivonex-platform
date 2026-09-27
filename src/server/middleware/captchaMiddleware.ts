import { Request, Response, NextFunction } from 'express';
import { verifyCaptcha, getCaptchaConfig } from '../services/captchaService';

export function requireCaptcha(action: 'login' | 'register' | 'forgotPassword' | 'withdrawal' | 'swap' | 'buyNode') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const config = getCaptchaConfig();

    // Check if CAPTCHA is enabled globally and for this specific action
    if (!config.enabled || !config.enforcedActions[action]) {
      return next();
    }

    const token = req.body.captchaToken || req.headers['x-captcha-token'] || req.query.captchaToken;
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '127.0.0.1';
    const userId = (req as any).user?.id || (req as any).userId;

    if (!token) {
      return res.status(400).json({
        error: 'CAPTCHA_REQUIRED',
        message: 'Security check is required for this action. Please complete the CAPTCHA verification.',
        action,
      });
    }

    try {
      const verification = await verifyCaptcha(String(token), action.toUpperCase(), clientIp, {
        answer: req.body.captchaAnswer,
        visualCode: req.body.captchaVisualCode,
        userId,
      });

      if (!verification.success) {
        return res.status(403).json({
          error: 'CAPTCHA_VERIFICATION_FAILED',
          message: 'CAPTCHA verification failed or expired. Please retry the security challenge.',
          details: verification.reasons,
        });
      }

      // Verification passed
      (req as any).captchaVerification = verification;
      next();
    } catch (err) {
      console.error('[requireCaptcha Middleware] Verification error:', err);
      // Fail safely if transient error or allow proceed if fallback
      next();
    }
  };
}
