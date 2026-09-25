import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/db';
import { hashToken } from '../utils/crypto';

export interface AuthenticatedUser {
  id: string;
  public_id: string;
  fullName: string;
  email: string;
  phone: string | null;
  country: string;
  status: string;
  role: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  created_at?: string;
  last_login_at?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  sessionTokenHash?: string;
  sessionId?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.phx_session || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

  if (!token) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Authentication required. No active session found.',
    });
    return;
  }

  try {
    const db = await getDb();
    const tokenHash = hashToken(token);

    // Query active session and user
    const sessionRes = await db.query(
      `
      SELECT 
        s.id AS session_id,
        s.expires_at,
        s.revoked_at,
        u.id AS user_id,
        u.public_id,
        u.full_name,
        u.email,
        u.phone,
        u.country,
        u.status,
        COALESCE(u.role, 'USER') AS role,
        u.email_verified_at,
        u.created_at,
        u.last_login_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = $1
      LIMIT 1
      `,
      [tokenHash]
    );

    if (sessionRes.rows.length === 0) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Invalid session token.',
      });
      return;
    }

    const row = sessionRes.rows[0];

    // Check revocation and expiry
    const isRevoked = !!row.revoked_at;
    const isExpired = new Date(row.expires_at).getTime() <= Date.now();

    if (isRevoked || isExpired) {
      res.status(401).json({
        error: 'SESSION_EXPIRED',
        message: 'Session has expired or been revoked.',
      });
      return;
    }

    // Check user account status
    if (row.status === 'SUSPENDED') {
      res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'Account is suspended. Please contact support.',
      });
      return;
    }

    if (row.status === 'LOCKED') {
      res.status(403).json({
        error: 'ACCOUNT_LOCKED',
        message: 'Account is locked for security reasons.',
      });
      return;
    }

    // Update last_used_at timestamp asynchronously
    db.query(`UPDATE sessions SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = $1`, [tokenHash]).catch(console.error);

    req.user = {
      id: row.user_id,
      public_id: row.public_id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      country: row.country,
      status: row.status,
      role: row.role || 'USER',
      emailVerified: !!row.email_verified_at,
      emailVerifiedAt: row.email_verified_at,
      created_at: row.created_at,
      last_login_at: row.last_login_at,
    };
    req.sessionId = row.session_id;
    req.sessionTokenHash = tokenHash;

    next();
  } catch (err) {
    console.error('[Auth Middleware Error]', err);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'An internal authentication error occurred.',
    });
  }
}

/**
 * requireAdmin
 * Strict administrative authorization middleware.
 * Ensures normal authenticated users CANNOT execute administrative endpoints
 * such as epoch creation or settlement.
 */
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_API_KEY || 'phivonex-admin-key-secure';

  if (adminKey && adminKey === expectedKey) {
    return next();
  }

  // Otherwise, enforce session auth and verify ADMIN role
  await requireAuth(req, res, () => {
    if (req.user?.role === 'ADMIN') {
      return next();
    }

    res.status(403).json({
      error: 'FORBIDDEN',
      message: 'Access denied. Administrative privileges required to manage reward epochs.',
    });
  });
}
