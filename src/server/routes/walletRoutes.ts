import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { getWalletSummary, getWalletTransactions } from '../services/walletLedgerService';

export const walletRouter = Router();

/**
 * GET /api/wallet/me
 * 
 * Returns the authenticated user's wallet summary:
 * - totalEarned
 * - totalReversed
 * - ledgerBalance
 * - transactionCount
 * - breakdown: referral, matching, promotion
 * 
 * Rules:
 * - Read-only financial ledger summary.
 * - Server-authoritative calculations only.
 * - No withdrawal endpoints implemented.
 */
walletRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const summary = await getWalletSummary(userId);
    return res.status(200).json(summary);
  } catch (err: any) {
    console.error('[Wallet API] Error in GET /api/wallet/me:', err);
    return res.status(500).json({ error: 'Failed to retrieve wallet summary' });
  }
});

/**
 * GET /api/wallet/transactions
 * 
 * Returns paginated financial ledger transactions for the authenticated user.
 * Query params:
 * - page (default 1)
 * - limit (default 20, max 100)
 */
walletRouter.get('/transactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const typeFilter = (req.query.type as string) || (req.query.sourceType as string) || undefined;
    const search = (req.query.search as string) || (req.query.q as string) || undefined;

    const result = await getWalletTransactions(userId, page, limit, typeFilter, search);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[Wallet API] Error in GET /api/wallet/transactions:', err);
    return res.status(500).json({ error: 'Failed to retrieve wallet transactions' });
  }
});
