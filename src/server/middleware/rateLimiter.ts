import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export interface RateLimitOptions {
  windowMs: number; // Time window in ms
  max: number; // Max attempts per window
  keyPrefix?: string;
  includeIdentifier?: boolean;
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix = 'rl', includeIdentifier = false } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    let key = `${keyPrefix}:${ip}`;

    if (includeIdentifier && req.body && req.body.identifier) {
      key += `:${String(req.body.identifier).toLowerCase().trim()}`;
    }

    const now = Date.now();
    let record = rateLimitStore.get(key);

    if (!record || record.resetAt <= now) {
      record = {
        count: 1,
        resetAt: now + windowMs,
      };
      rateLimitStore.set(key, record);
      return next();
    }

    record.count += 1;

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: `Too many attempts. Please try again in ${retryAfterSeconds} seconds.`,
      });
    }

    return next();
  };
}

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  keyPrefix: 'auth',
});

export const passwordResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: 'pwd_reset',
});
