import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/authMiddleware';
import {
  getUserRewards,
  getUserRewardsSummary,
  claimUserRewards,
  createRewardEpoch,
  closeAndSettleEpoch,
} from '../services/nodeRewardService';

export const rewardRouter = Router();

/**
 * GET /api/rewards/me
 * Authenticated user endpoint returning:
 * - totalAccrued
 * - totalClaimed
 * - latestEpoch
 * - history (reward history)
 */
rewardRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const rewardsData = await getUserRewards(user.id);

    res.status(200).json({
      totalAccrued: rewardsData.totalAccrued,
      totalClaimed: rewardsData.totalClaimed,
      totalRewards: rewardsData.totalRewards,
      dailyEmissionRate: rewardsData.dailyEmissionRate,
      protocolDailyEmission: rewardsData.protocolDailyEmission,
      latestEpoch: rewardsData.latestEpoch,
      history: rewardsData.history,
    });
  } catch (err: any) {
    console.error('[Reward API] Error in GET /api/rewards/me:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve reward telemetry.',
    });
  }
});

/**
 * GET /api/rewards/summary
 * Authenticated user endpoint returning real authenticated-user reward totals.
 */
rewardRouter.get('/summary', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const summary = await getUserRewardsSummary(user.id);

    res.status(200).json(summary);
  } catch (err: any) {
    console.error('[Reward API] Error in GET /api/rewards/summary:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve reward summary.',
    });
  }
});

/**
 * GET /api/rewards/history
 * Authenticated user endpoint returning reward history records with sorting and epoch details.
 */
rewardRouter.get('/history', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const rewardsData = await getUserRewards(user.id);

    res.status(200).json({
      success: true,
      history: rewardsData.history,
      total: rewardsData.history.length,
      latestEpoch: rewardsData.latestEpoch,
    });
  } catch (err: any) {
    console.error('[Reward API] Error in GET /api/rewards/history:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve reward history.',
    });
  }
});

/**
 * POST /api/rewards/claim
 * Safe claim foundation: Transitions ACCRUED → CLAIMED.
 *
 * Security:
 * - Claim must not create money twice.
 * - All writes are strictly server-authoritative.
 */
rewardRouter.post('/claim', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const result = await claimUserRewards(user.id);

    res.status(200).json({
      success: true,
      message: result.claimedCount > 0
        ? `Successfully claimed ${result.claimedCount} accrued reward(s).`
        : 'No accrued rewards pending claim.',
      claimedCount: result.claimedCount,
      totalClaimedAmount: result.totalClaimedAmount,
    });
  } catch (err: any) {
    console.error('[Reward API] Error in POST /api/rewards/claim:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to process reward claim.',
    });
  }
});

/**
 * POST /api/rewards/epochs (Administrative Endpoint)
 * Creates an authoritative reward epoch in OPEN state.
 * Protected by requireAdmin middleware. Normal users CANNOT execute.
 */
rewardRouter.post('/epochs', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const epoch = await createRewardEpoch();
    res.status(201).json(epoch);
  } catch (err: any) {
    console.error('[Reward API] Error in POST /api/rewards/epochs:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to create reward epoch.',
    });
  }
});

/**
 * POST /api/rewards/epochs/:id/settle (Administrative Endpoint)
 * Closes and settles the specified epoch, distributing rewards to all ACTIVE nodes.
 * Protected by requireAdmin middleware. Normal users CANNOT execute.
 */
rewardRouter.post('/epochs/:id/settle', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await closeAndSettleEpoch(id);
    if (!result.success && result.error === 'REWARD_RATE_NOT_CONFIGURED') {
      res.status(422).json(result);
      return;
    }
    res.status(200).json(result);
  } catch (err: any) {
    console.error('[Reward API] Error in POST /api/rewards/epochs/:id/settle:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message || 'Failed to settle reward epoch.',
    });
  }
});

/**
 * GET /api/rewards/admin/status (Administrative Endpoint)
 * Returns status of reward distribution engine:
 * - mode (AUTOMATIC or MANUAL)
 * - nodeRewardsEnabled
 * - activeRatePerNode
 * - activeNodesCount
 * - lastSettledEpoch
 */
rewardRouter.get('/admin/status', requireAdmin, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { getAdminRewardStatus } = await import('../services/nodeRewardService');
    const status = await getAdminRewardStatus();
    res.status(200).json({ success: true, ...status });
  } catch (err: any) {
    console.error('[Reward API] Error in GET /api/rewards/admin/status:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve reward engine status.' });
  }
});

/**
 * PUT /api/rewards/admin/mode (Administrative Endpoint)
 * Switches distribution mode between 'AUTOMATIC' and 'MANUAL'.
 */
rewardRouter.put('/admin/mode', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const admin = req.user!;
    const { mode, reason } = req.body || {};
    if (mode !== 'AUTOMATIC' && mode !== 'MANUAL') {
      res.status(400).json({ error: 'INVALID_INPUT', message: 'Mode must be either AUTOMATIC or MANUAL.' });
      return;
    }

    const { setRewardDistributionMode } = await import('../services/nodeRewardService');
    await setRewardDistributionMode(mode, admin.id, admin.public_id, reason);

    res.status(200).json({
      success: true,
      mode,
      message: `Daily reward distribution mode successfully switched to ${mode}.`,
    });
  } catch (err: any) {
    console.error('[Reward API] Error in PUT /api/rewards/admin/mode:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update reward distribution mode.' });
  }
});

/**
 * POST /api/rewards/admin/distribute-daily-now (Administrative Endpoint)
 * Manually triggers the daily node mining reward distribution.
 * Distributes to all active nodes, posts financial ledger credits, and sends notifications.
 */
rewardRouter.post('/admin/distribute-daily-now', requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const admin = req.user!;
    const { customRatePerNode } = req.body || {};
    const { executeDailyRewardDistribution } = await import('../services/nodeRewardService');

    const result = await executeDailyRewardDistribution({
      triggeredBy: 'ADMIN_MANUAL',
      adminId: admin.id,
      adminPublicId: admin.public_id,
      customRatePerNode: typeof customRatePerNode === 'number' && customRatePerNode > 0 ? customRatePerNode : undefined,
    });

    if (!result.success && result.error === 'REWARD_RATE_NOT_CONFIGURED') {
      res.status(422).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (err: any) {
    console.error('[Reward API] Error in POST /api/rewards/admin/distribute-daily-now:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message || 'Failed to execute manual reward distribution.',
    });
  }
});
