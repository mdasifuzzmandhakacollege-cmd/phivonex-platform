import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { evaluateUserPromotions } from '../services/promotionBonusService';

export const promotionRouter = Router();

/**
 * GET /api/promotions/me
 * 
 * Returns the authenticated user's:
 * - current LEFT/RIGHT volume progress
 * - achieved milestones (20/20, 50/50, 100/100)
 * - next milestone requirements & progress
 * - total promotion bonus earned
 * - full milestones breakdown
 * 
 * Rules:
 * - Server evaluates and awards qualified promotions automatically.
 * - Frontend never submits bonus amounts or tiers.
 * - Enforces authentication and isolates user data.
 */
promotionRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const summary = await evaluateUserPromotions(userId);
    return res.status(200).json(summary);
  } catch (err: any) {
    console.error('[Promotion API] Error in GET /api/promotions/me:', err);
    return res.status(500).json({ error: 'Failed to retrieve promotion status' });
  }
});
