import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/authMiddleware';
import { withdrawalLimiter, adminFinancialLimiter } from '../middleware/rateLimiter';
import { validateEvmAddress } from '../middleware/securityMiddleware';
import {
  createWithdrawalRequest,
  getUserWithdrawals,
  getWithdrawalByPublicId,
  cancelWithdrawalRequest,
  settleWithdrawalAction,
} from '../services/withdrawalService';
import { broadcastBnbWithdrawal } from '../services/bscSignerService';

export const withdrawalRouter = Router();

/**
 * POST /api/withdrawals
 * Create a new withdrawal request from eligible available balance.
 */
withdrawalRouter.post('/', requireAuth, withdrawalLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { amount, destinationType, destinationReference, idempotencyKey } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || !isFinite(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        error: 'INVALID_AMOUNT',
        message: 'Withdrawal amount must be a positive number greater than 0.',
      });
    }

    const destType = String(destinationType || 'BEP20').toUpperCase();
    if (destType === 'BEP20' || destType === 'BNB') {
      const addrCheck = validateEvmAddress(destinationReference);
      if (!addrCheck.valid) {
        return res.status(400).json({
          error: 'INVALID_DESTINATION_ADDRESS',
          message: addrCheck.error || 'Invalid destination wallet address.',
        });
      }
    }

    const withdrawal = await createWithdrawalRequest({
      userId,
      amount: numAmount,
      destinationType: destType,
      destinationReference: String(destinationReference || '').trim(),
      idempotencyKey: idempotencyKey ? String(idempotencyKey) : undefined,
    });

    return res.status(201).json(withdrawal);
  } catch (err: any) {
    const message = err?.message || 'An error occurred while requesting withdrawal.';

    if (message.startsWith('INSUFFICIENT_BALANCE')) {
      return res.status(422).json({
        error: 'INSUFFICIENT_BALANCE',
        message,
        availableBalance: err?.availableBalance,
      });
    }

    if (message.startsWith('MINIMUM_AMOUNT_LIMIT') || message.startsWith('INVALID_AMOUNT') || message.startsWith('INVALID_DESTINATION')) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message,
      });
    }

    console.error('[Withdrawal API] Error creating withdrawal:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message,
    });
  }
});

/**
 * GET /api/withdrawals/me
 * Retrieve authenticated user's withdrawal history.
 */
withdrawalRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const status = (req.query.status as string) || undefined;

    const history = await getUserWithdrawals(userId, page, limit, status);
    return res.status(200).json(history);
  } catch (err: any) {
    console.error('[Withdrawal API] Error fetching history:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve withdrawal history.',
    });
  }
});

/**
 * GET /api/withdrawals/:publicId
 * Get a specific withdrawal record owned by the user.
 */
withdrawalRouter.get('/:publicId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { publicId } = req.params;

    const withdrawal = await getWithdrawalByPublicId(publicId, userId);
    if (!withdrawal) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Withdrawal record not found or access denied.',
      });
    }

    return res.status(200).json(withdrawal);
  } catch (err: any) {
    console.error('[Withdrawal API] Error fetching withdrawal:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to fetch withdrawal record.',
    });
  }
});

/**
 * POST /api/withdrawals/:publicId/cancel
 * Cancel a pending withdrawal request and release reserved funds.
 */
withdrawalRouter.post('/:publicId/cancel', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { publicId } = req.params;

    const updated = await cancelWithdrawalRequest(publicId, userId);
    return res.status(200).json(updated);
  } catch (err: any) {
    const message = err?.message || 'Failed to cancel withdrawal request.';
    if (message.startsWith('NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message });
    }
    if (message.startsWith('INVALID_STATE')) {
      return res.status(400).json({ error: 'INVALID_STATE', message });
    }
    console.error('[Withdrawal API] Error cancelling withdrawal:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message });
  }
});

/**
 * POST /api/withdrawals/admin/settle
 * Admin-only settlement state machine trigger (APPROVE, COMPLETE, REJECT, FAIL).
 */
withdrawalRouter.post('/admin/settle', requireAdmin, adminFinancialLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { publicId, action, rejectionReason } = req.body;

    if (!publicId || !action) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Missing publicId or action parameter.',
      });
    }

    const updated = await settleWithdrawalAction({
      withdrawalIdOrPublicId: String(publicId),
      action: action.toUpperCase() as any,
      rejectionReason: rejectionReason ? String(rejectionReason) : undefined,
    });

    return res.status(200).json(updated);
  } catch (err: any) {
    const message = err?.message || 'Failed to process settlement action.';
    if (message.startsWith('NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message });
    }
    if (message.startsWith('INVALID_STATE') || message.startsWith('INVALID_ACTION')) {
      return res.status(400).json({ error: 'INVALID_STATE', message });
    }
    console.error('[Withdrawal API] Settlement error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message });
  }
});

/**
 * POST /api/withdrawals/admin/broadcast-bsc
 * Admin-only on-chain broadcast trigger for BNB Smart Chain withdrawal settlement.
 */
withdrawalRouter.post('/admin/broadcast-bsc', requireAdmin, adminFinancialLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Missing publicId parameter.',
      });
    }

    const result = await broadcastBnbWithdrawal({
      withdrawalPublicId: String(publicId),
    });

    return res.status(200).json({
      success: true,
      message: `Withdrawal successfully broadcasted to BNB Smart Chain.`,
      data: result,
    });
  } catch (err: any) {
    const message = err?.message || 'Failed to broadcast BNB withdrawal.';
    if (message.includes('INSUFFICIENT_GAS_RESERVE')) {
      return res.status(422).json({ error: 'INSUFFICIENT_GAS_RESERVE', message });
    }
    if (message.includes('ALREADY_BROADCASTED')) {
      return res.status(409).json({ error: 'ALREADY_BROADCASTED', message });
    }
    if (message.startsWith('NOT_FOUND')) {
      return res.status(404).json({ error: 'NOT_FOUND', message });
    }
    if (message.startsWith('INVALID_STATE') || message.startsWith('INVALID_DESTINATION')) {
      return res.status(400).json({ error: 'BAD_REQUEST', message });
    }
    console.error('[Withdrawal API] BSC broadcast error:', err);
    return res.status(500).json({ error: 'BROADCAST_ERROR', message });
  }
});

