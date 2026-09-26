import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/db';
import { hashPassword, verifyPassword, generateRandomToken, hashToken } from '../utils/crypto';
import { generatePublicId, generateReferralCode, normalizeReferralCode } from '../utils/idGenerator';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { authLimiter, loginLimiter, registrationLimiter, passwordResetLimiter } from '../middleware/rateLimiter';
import { logSecurityEvent, parseUserAgentSummary } from '../utils/securityLogger';

const router = Router();

const SESSION_COOKIE_NAME = 'phx_session';
const SESSION_DURATION_DAYS = 30;

function setSessionCookie(res: Response, rawToken: string, rememberMe = true) {
  const maxAge = rememberMe ? SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000 : undefined;
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Helper to generate a collision-free public_id
 */
async function getUniquePublicId(db: any): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const candidate = generatePublicId();
    const res = await db.query(`SELECT 1 FROM users WHERE public_id = $1`, [candidate]);
    if (res.rowCount === 0) return candidate;
    attempts++;
  }
  return `PHX-${uuidv4().slice(0, 6).toUpperCase()}`;
}

/**
 * Helper to generate a collision-free referral_code
 */
async function getUniqueReferralCode(db: any): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const candidate = generateReferralCode();
    const res = await db.query(`SELECT 1 FROM user_referrals WHERE referral_code = $1`, [candidate]);
    if (res.rowCount === 0) return candidate;
    attempts++;
  }
  return `PHX${uuidv4().slice(0, 6).toUpperCase()}`;
}

/**
 * POST /api/auth/register
 * User registration with Argon2id hashing, unique public_id, referral code generation, and sponsor resolution.
 */
router.post('/register', registrationLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, phone, country, password, referralCode } = req.body;

    // 1. Validation
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      res.status(400).json({ error: 'INVALID_NAME', message: 'Full name is required (min 2 characters).' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      res.status(400).json({ error: 'INVALID_EMAIL', message: 'A valid email address is required.' });
      return;
    }

    if (!country || typeof country !== 'string') {
      res.status(400).json({ error: 'INVALID_COUNTRY', message: 'Country is required.' });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 10) {
      res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'Password must be at least 10 characters long.',
      });
      return;
    }

    const db = await getDb();
    const normalizedEmail = email.trim().toLowerCase();
    const cleanPhone = phone ? phone.trim() : null;

    // 2. Check for duplicate email
    const existingEmail = await db.query(`SELECT id FROM users WHERE LOWER(email) = $1`, [normalizedEmail]);
    if (existingEmail.rowCount > 0) {
      res.status(409).json({ error: 'EMAIL_EXISTS', message: 'An account with this email address already exists.' });
      return;
    }

    // 3. Check for duplicate phone if provided
    if (cleanPhone) {
      const existingPhone = await db.query(`SELECT id FROM users WHERE phone = $1`, [cleanPhone]);
      if (existingPhone.rowCount > 0) {
        res.status(409).json({ error: 'PHONE_EXISTS', message: 'An account with this phone number already exists.' });
        return;
      }
    }

    // 4. Resolve sponsor user ID if referralCode provided
    let sponsorUserId: string | null = null;
    let pendingCodeToStore: string | null = null;

    if (referralCode && typeof referralCode === 'string' && referralCode.trim() !== '') {
      const normalizedCode = normalizeReferralCode(referralCode);
      const sponsorResult = await db.query<{ user_id: string }>(
        `SELECT user_id FROM user_referrals WHERE referral_code = $1`,
        [normalizedCode]
      );

      if (sponsorResult.rowCount > 0) {
        sponsorUserId = sponsorResult.rows[0].user_id;
      } else {
        pendingCodeToStore = normalizedCode;
      }
    }

    // 5. Hash password with Argon2id
    const passwordHash = await hashPassword(password);
    const userId = uuidv4();
    const publicId = await getUniquePublicId(db);
    const newReferralCode = await getUniqueReferralCode(db);

    // 6. Insert user record
    await db.query(
      `INSERT INTO users (
        id, public_id, full_name, email, phone, country, password_hash,
        status, pending_referral_code, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        userId,
        publicId,
        fullName.trim(),
        normalizedEmail,
        cleanPhone,
        country.trim(),
        passwordHash,
        pendingCodeToStore,
      ]
    );

    // 7. Insert user_referrals record
    await db.query(
      `INSERT INTO user_referrals (user_id, referral_code, sponsor_user_id, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [userId, newReferralCode, sponsorUserId]
    );

    // 7b. Insert initial binary_placements record (UNPLACED)
    await db.query(
      `INSERT INTO binary_placements (user_id, parent_user_id, side, status, placed_at, created_at)
       VALUES ($1, NULL, NULL, 'UNPLACED', NULL, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    // 8. Create session
    const rawSessionToken = generateRandomToken(32);
    const sessionTokenHash = hashToken(rawSessionToken);
    const sessionExpiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const userAgent = req.headers['user-agent'] || '';

    await db.query(
      `INSERT INTO sessions (id, user_id, token_hash, user_agent, expires_at, created_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [uuidv4(), userId, sessionTokenHash, userAgent, sessionExpiresAt]
    );

    // 9. Record security audit event
    await logSecurityEvent(db, {
      userId,
      eventType: 'ACCOUNT_REGISTERED',
      description: 'Account successfully registered and authenticated.',
      userAgent,
    });

    // Send Welcome and Sponsor Notifications via Email Automation Engine
    try {
      const { queueEventEmail } = await import('../services/emailService');
      // Queue Welcome Email
      await queueEventEmail(normalizedEmail, 'WELCOME', {
        displayName: fullName.trim(),
        publicId,
        signupTime: new Date().toISOString()
      });

      // Queue Sponsor Notification
      if (sponsorUserId) {
        const sponsorRes = await db.query<{ email: string }>(
          `SELECT email FROM users WHERE id = $1`,
          [sponsorUserId]
        );
        if (sponsorRes.rowCount > 0) {
          // Send privacy-safe sponsor notification containing only safe display name, public ID, and signup time.
          const nameParts = fullName.trim().split(' ');
          const safeDisplayName = nameParts.length > 1 
            ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.` 
            : nameParts[0];

          await queueEventEmail(sponsorRes.rows[0].email, 'REFERRAL_SIGNUP', {
            displayName: safeDisplayName,
            publicId,
            signupTime: new Date().toISOString()
          });
        }
      }
    } catch (emailErr) {
      console.error('[Auth API] Failed to queue welcome/sponsor emails:', emailErr);
    }

    setSessionCookie(res, rawSessionToken, true);

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: userId,
        publicId,
        referralCode: newReferralCode,
        fullName: fullName.trim(),
        email: normalizedEmail,
        phone: cleanPhone,
        country: country.trim(),
        status: 'ACTIVE',
        emailVerified: false,
      },
    });
  } catch (err) {
    console.error('[Auth API] Error in /register:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'An unexpected error occurred during registration.' });
  }
});

/**
 * POST /api/auth/login
 * User login supporting email or phone identifier, Argon2id verification, session creation.
 */
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { identifier, password, rememberMe = true } = req.body;

    if (!identifier || !password) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Identifier (email/phone) and password are required.',
      });
      return;
    }

    const db = await getDb();
    const cleanIdentifier = identifier.trim().toLowerCase();

    // Query user by email or phone joined with user_referrals
    const result = await db.query<{
      id: string;
      public_id: string;
      full_name: string;
      email: string;
      phone: string | null;
      country: string;
      password_hash: string;
      status: string;
      email_verified_at: Date | null;
      referral_code: string | null;
    }>(
      `SELECT u.id, u.public_id, u.full_name, u.email, u.phone, u.country, u.password_hash, u.status, u.email_verified_at, r.referral_code
       FROM users u
       LEFT JOIN user_referrals r ON u.id = r.user_id
       WHERE LOWER(u.email) = $1 OR u.phone = $2`,
      [cleanIdentifier, identifier.trim()]
    );

    if (result.rowCount === 0) {
      await logSecurityEvent(db, {
        userId: null,
        eventType: 'FAILED_LOGIN',
        description: `Failed login attempt for identifier '${cleanIdentifier}' (user not found).`,
        userAgent: req.headers['user-agent'],
      });

      res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email/phone or password.',
      });
      return;
    }

    const user = result.rows[0];

    // Check account status
    if (user.status === 'SUSPENDED' || user.status === 'LOCKED') {
      res.status(403).json({
        error: 'ACCOUNT_SUSPENDED',
        message: 'This account has been suspended or locked. Please contact security support.',
      });
      return;
    }

    // Verify Argon2id password hash
    const isValid = await verifyPassword(user.password_hash, password);
    if (!isValid) {
      await logSecurityEvent(db, {
        userId: user.id,
        eventType: 'FAILED_LOGIN',
        description: `Failed login attempt for user ${user.public_id} (incorrect password).`,
        userAgent: req.headers['user-agent'],
      });

      res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email/phone or password.',
      });
      return;
    }

    // Update last_login_at
    await db.query(`UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`, [user.id]);

    // Create session
    const durationDays = rememberMe ? SESSION_DURATION_DAYS : 1;
    const rawSessionToken = generateRandomToken(32);
    const sessionTokenHash = hashToken(rawSessionToken);
    const sessionExpiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    const userAgent = req.headers['user-agent'] || '';

    await db.query(
      `INSERT INTO sessions (id, user_id, token_hash, user_agent, expires_at, created_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [uuidv4(), user.id, sessionTokenHash, userAgent, sessionExpiresAt]
    );

    // Record login security event
    await logSecurityEvent(db, {
      userId: user.id,
      eventType: 'LOGIN_SUCCESS',
      description: 'Session authentication handshake completed.',
      userAgent,
    });

    setSessionCookie(res, rawSessionToken, rememberMe);

    res.status(200).json({
      message: 'Logged in successfully',
      user: {
        id: user.id,
        publicId: user.public_id,
        referralCode: user.referral_code,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        country: user.country,
        status: user.status,
        emailVerified: Boolean(user.email_verified_at),
      },
    });
  } catch (err) {
    console.error('[Auth API] Error in /login:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'An unexpected error occurred during sign in.' });
  }
});

/**
 * GET /api/auth/me
 * Returns authenticated user profile including publicId and referralCode.
 */
router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const db = await getDb();

    // Query referral_code
    const refRes = await db.query<{ referral_code: string }>(
      `SELECT referral_code FROM user_referrals WHERE user_id = $1`,
      [user.id]
    );

    const referralCode = refRes.rowCount > 0 ? refRes.rows[0].referral_code : null;

    res.status(200).json({
      user: {
        id: user.id,
        publicId: user.public_id,
        referralCode,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        country: user.country,
        status: user.status,
        emailVerified: user.emailVerified,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      },
    });
  } catch (err) {
    console.error('[Auth API] Error in /me:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve user profile.' });
  }
});

/**
 * POST /api/auth/logout
 * Revokes active session and clears session cookie.
 */
router.post('/logout', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const db = await getDb();
    if (req.sessionId) {
      await db.query(
        `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [req.sessionId]
      );

      await logSecurityEvent(db, {
        userId: req.user!.id,
        eventType: 'SESSION_REVOKED',
        description: 'Operator explicitly terminated active session.',
        userAgent: req.headers['user-agent'],
      });
    }

    clearSessionCookie(res);
    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('[Auth API] Error in /logout:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to complete logout.' });
  }
});

/**
 * POST /api/auth/change-password
 * Requires currentPassword, newPassword, confirmPassword.
 * Verifies current password, enforces min 10 chars on new password, hashes with Argon2id,
 * revokes all other sessions for the user, and records security activity.
 */
router.post('/change-password', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { currentPassword, newPassword, confirmNewPassword, confirmPassword } = req.body;
    const confirmation = confirmNewPassword || confirmPassword;

    if (!currentPassword || !newPassword || !confirmation) {
      res.status(400).json({
        error: 'MISSING_FIELDS',
        message: 'Current password, new password, and confirmation are required.',
      });
      return;
    }

    if (newPassword !== confirmation) {
      res.status(400).json({
        error: 'PASSWORD_MISMATCH',
        message: 'New password and confirmation do not match.',
      });
      return;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 10) {
      res.status(400).json({
        error: 'WEAK_PASSWORD',
        message: 'New password must be at least 10 characters long.',
      });
      return;
    }

    const db = await getDb();

    // Fetch current password hash
    const userRes = await db.query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [user.id]
    );

    if (userRes.rowCount === 0) {
      res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User account not found.' });
      return;
    }

    const currentHash = userRes.rows[0].password_hash;
    const isCurrentValid = await verifyPassword(currentHash, currentPassword);

    if (!isCurrentValid) {
      res.status(401).json({
        error: 'INVALID_PASSWORD',
        message: 'The current password provided is incorrect.',
      });
      return;
    }

    // Hash new password with Argon2id
    const newPasswordHash = await hashPassword(newPassword);

    // Update password in database
    await db.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newPasswordHash, user.id]
    );

    // Revoke all OTHER active sessions for this user (keep current session active)
    if (req.sessionId) {
      await db.query(
        `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL`,
        [user.id, req.sessionId]
      );
    }

    // Record security event
    await logSecurityEvent(db, {
      userId: user.id,
      eventType: 'PASSWORD_CHANGED',
      description: 'Account password updated. All other active sessions terminated.',
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      message: 'Password changed successfully. All other active sessions have been terminated.',
    });
  } catch (err) {
    console.error('[Auth API] Error in /change-password:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update password.' });
  }
});

/**
 * GET /api/auth/sessions
 * Returns real active sessions for the authenticated user without exposing raw tokens.
 */
router.get('/sessions', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const db = await getDb();

    const sessionsRes = await db.query(
      `
      SELECT 
        id,
        user_agent,
        created_at AS "createdAt",
        last_used_at AS "lastUsedAt",
        expires_at AS "expiresAt"
      FROM sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_used_at DESC
      `,
      [user.id]
    );

    const formattedSessions = sessionsRes.rows.map((s) => ({
      id: s.id,
      isCurrent: s.id === req.sessionId,
      device: parseUserAgentSummary(s.user_agent),
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
    }));

    res.status(200).json({
      sessions: formattedSessions,
    });
  } catch (err) {
    console.error('[Auth API] Error in GET /sessions:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve active sessions.' });
  }
});

/**
 * DELETE /api/auth/sessions/:sessionId
 * Allows users to revoke one of their own active sessions.
 */
router.delete('/sessions/:sessionId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({ error: 'MISSING_SESSION_ID', message: 'Session ID is required.' });
      return;
    }

    const db = await getDb();

    // Ensure the session belongs to this authenticated user
    const checkRes = await db.query(
      `SELECT id, user_agent FROM sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, user.id]
    );

    if (checkRes.rowCount === 0) {
      res.status(404).json({
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found or not authorized to revoke.',
      });
      return;
    }

    // Revoke the session
    await db.query(
      `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`,
      [sessionId, user.id]
    );

    const isCurrent = sessionId === req.sessionId;
    if (isCurrent) {
      clearSessionCookie(res);
    }

    // Log security activity
    await logSecurityEvent(db, {
      userId: user.id,
      eventType: 'SESSION_REVOKED',
      description: isCurrent ? 'Current session revoked by operator.' : 'Remote session revoked by operator.',
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      message: 'Session revoked successfully.',
      isCurrent,
    });
  } catch (err) {
    console.error('[Auth API] Error in DELETE /sessions/:sessionId:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to revoke session.' });
  }
});

/**
 * POST /api/auth/sessions/:sessionId/revoke (Alternative method for POST clients)
 */
router.post('/sessions/:sessionId/revoke', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { sessionId } = req.params;

    const db = await getDb();
    const checkRes = await db.query(
      `SELECT id FROM sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, user.id]
    );

    if (checkRes.rowCount === 0) {
      res.status(404).json({
        error: 'SESSION_NOT_FOUND',
        message: 'Session not found or not authorized to revoke.',
      });
      return;
    }

    await db.query(
      `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`,
      [sessionId, user.id]
    );

    const isCurrent = sessionId === req.sessionId;
    if (isCurrent) {
      clearSessionCookie(res);
    }

    await logSecurityEvent(db, {
      userId: user.id,
      eventType: 'SESSION_REVOKED',
      description: isCurrent ? 'Current session revoked by operator.' : 'Remote session revoked by operator.',
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      message: 'Session revoked successfully.',
      isCurrent,
    });
  } catch (err) {
    console.error('[Auth API] Error in POST /sessions/:sessionId/revoke:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to revoke session.' });
  }
});

/**
 * POST /api/auth/sessions/revoke-others
 * Terminates all active sessions for the current user except the active one.
 */
router.post('/sessions/revoke-others', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const currentSessionId = req.sessionId;

    if (!currentSessionId) {
      res.status(400).json({ error: 'NO_ACTIVE_SESSION', message: 'No active session found.' });
      return;
    }

    const db = await getDb();

    await db.query(
      `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND id != $2 AND revoked_at IS NULL`,
      [user.id, currentSessionId]
    );

    await logSecurityEvent(db, {
      userId: user.id,
      eventType: 'SESSIONS_REVOKED_ALL_OTHERS',
      description: 'Logged out of all other active devices.',
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      message: 'All other active devices and sessions have been logged out.',
    });
  } catch (err) {
    console.error('[Auth API] Error in /sessions/revoke-others:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to terminate other sessions.' });
  }
});

/**
 * POST /api/auth/resend-verification
 * Dispatches a new email verification token for authenticated or unauthenticated users.
 */
router.post('/resend-verification', async (req: Request, res: Response): Promise<void> => {
  try {
    let targetEmail: string | null = null;
    let targetUserId: string | null = null;

    // Check if called with auth session
    const token = req.cookies?.phx_session || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
    const db = await getDb();

    if (token) {
      const tokenHash = hashToken(token);
      const sessionRes = await db.query<{ user_id: string; email: string; email_verified_at: Date | null }>(
        `SELECT s.user_id, u.email, u.email_verified_at 
         FROM sessions s 
         JOIN users u ON s.user_id = u.id 
         WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP`,
        [tokenHash]
      );
      if (sessionRes.rowCount > 0) {
        if (sessionRes.rows[0].email_verified_at) {
          res.status(200).json({ message: 'Email address is already verified.' });
          return;
        }
        targetUserId = sessionRes.rows[0].user_id;
        targetEmail = sessionRes.rows[0].email;
      }
    }

    if (!targetUserId && req.body.email) {
      const emailRes = await db.query<{ id: string; email: string; email_verified_at: Date | null }>(
        `SELECT id, email, email_verified_at FROM users WHERE LOWER(email) = $1`,
        [req.body.email.trim().toLowerCase()]
      );
      if (emailRes.rowCount > 0) {
        if (emailRes.rows[0].email_verified_at) {
          res.status(200).json({ message: 'Email address is already verified.' });
          return;
        }
        targetUserId = emailRes.rows[0].id;
        targetEmail = emailRes.rows[0].email;
      }
    }

    if (targetUserId && targetEmail) {
      const rawVerifyToken = generateRandomToken(32);
      const verifyTokenHash = hashToken(rawVerifyToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await db.query(
        `INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, created_at)
         VALUES ($1, $2, 'EMAIL_VERIFY', $3, $4, CURRENT_TIMESTAMP)`,
        [uuidv4(), targetUserId, verifyTokenHash, expiresAt]
      );

      await logSecurityEvent(db, {
        userId: targetUserId,
        eventType: 'EMAIL_VERIFICATION_SENT',
        description: `Verification link dispatched to ${targetEmail}.`,
        userAgent: req.headers['user-agent'],
      });
    }

    res.status(200).json({
      message: 'If the account exists and is unverified, a verification link has been dispatched.',
    });
  } catch (err) {
    console.error('[Auth API] Error in /resend-verification:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to process verification dispatch.' });
  }
});

/**
 * POST /api/auth/forgot-password
 * Enumeration-safe password reset token generation.
 */
router.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'INVALID_EMAIL', message: 'Valid email address is required.' });
      return;
    }

    const db = await getDb();
    const userRes = await db.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE LOWER(email) = $1`,
      [email.trim().toLowerCase()]
    );

    if (userRes.rowCount > 0) {
      const user = userRes.rows[0];
      const rawResetToken = generateRandomToken(32);
      const tokenHash = hashToken(rawResetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.query(
        `INSERT INTO auth_tokens (id, user_id, type, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
        [uuidv4(), user.id, 'PASSWORD_RESET', tokenHash, expiresAt]
      );
    }

    res.status(200).json({
      message: 'If an account exists with this email, password reset instructions have been generated.',
    });
  } catch (err) {
    console.error('[Auth API] Error in /forgot-password:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to process password recovery request.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Validates token, hashes new password with Argon2id, marks token used, and revokes all active sessions.
 */
router.post('/reset-password', passwordResetLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: 'MISSING_FIELDS', message: 'Token and new password are required.' });
      return;
    }

    if (typeof newPassword !== 'string' || newPassword.length < 10) {
      res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Password must be at least 10 characters long.' });
      return;
    }

    const db = await getDb();
    const tokenHash = hashToken(token);

    const tokenRes = await db.query<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
      `SELECT id, user_id, expires_at, used_at FROM auth_tokens WHERE token_hash = $1 AND type = 'PASSWORD_RESET'`,
      [tokenHash]
    );

    if (tokenRes.rowCount === 0) {
      res.status(400).json({ error: 'INVALID_TOKEN', message: 'Invalid or expired password reset token.' });
      return;
    }

    const tokenRecord = tokenRes.rows[0];

    if (tokenRecord.used_at) {
      res.status(400).json({ error: 'TOKEN_USED', message: 'This password reset token has already been used.' });
      return;
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      res.status(400).json({ error: 'TOKEN_EXPIRED', message: 'Password reset token has expired.' });
      return;
    }

    const newPasswordHash = await hashPassword(newPassword);

    await db.query(
      `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newPasswordHash, tokenRecord.user_id]
    );

    await db.query(
      `UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [tokenRecord.id]
    );

    await db.query(
      `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`,
      [tokenRecord.user_id]
    );

    await logSecurityEvent(db, {
      userId: tokenRecord.user_id,
      eventType: 'PASSWORD_CHANGED',
      description: 'Password reset via cryptographic recovery token.',
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ message: 'Password has been reset successfully. Please log in with your new password.' });
  } catch (err) {
    console.error('[Auth API] Error in /reset-password:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to reset password.' });
  }
});

/**
 * POST /api/auth/verify-email
 */
router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'MISSING_TOKEN', message: 'Verification token is required.' });
      return;
    }

    const db = await getDb();
    const tokenHash = hashToken(token);

    const tokenRes = await db.query<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
      `SELECT id, user_id, expires_at, used_at FROM auth_tokens WHERE token_hash = $1 AND type = 'EMAIL_VERIFY'`,
      [tokenHash]
    );

    if (tokenRes.rowCount === 0) {
      res.status(400).json({ error: 'INVALID_TOKEN', message: 'Invalid or expired verification token.' });
      return;
    }

    const tokenRecord = tokenRes.rows[0];

    if (tokenRecord.used_at) {
      res.status(400).json({ error: 'TOKEN_USED', message: 'This email verification token has already been used.' });
      return;
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      res.status(400).json({ error: 'TOKEN_EXPIRED', message: 'Verification token has expired.' });
      return;
    }

    await db.query(
      `UPDATE users SET email_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [tokenRecord.user_id]
    );

    await db.query(
      `UPDATE auth_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [tokenRecord.id]
    );

    await logSecurityEvent(db, {
      userId: tokenRecord.user_id,
      eventType: 'EMAIL_VERIFIED',
      description: 'Email address verified successfully.',
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ message: 'Email address has been successfully verified.' });
  } catch (err) {
    console.error('[Auth API] Error in /verify-email:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to verify email.' });
  }
});

export default router;
