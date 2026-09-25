import { Router, Response } from 'express';
import { requireAdmin, AuthRequest } from '../middleware/authMiddleware';
import {
  getAdminSummaryMetrics,
  getAdminUsersList,
  getAdminNodesList,
  getAdminOrdersList,
  getAdminWithdrawalsList,
  getAdminTransactionsList,
  getAdminAuditLogs,
  logAdminAction,
} from '../services/adminService';
import { settleWithdrawalAction } from '../services/withdrawalService';

export const adminRouter = Router();

// Enforce requireAdmin on ALL admin routes
adminRouter.use(requireAdmin);

/**
 * GET /api/admin/summary
 * Returns real system-wide aggregate metrics for the Admin Dashboard.
 */
adminRouter.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const summary = await getAdminSummaryMetrics();
    return res.status(200).json(summary);
  } catch (err: any) {
    console.error('[Admin API] Error fetching summary:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve administrative summary metrics.',
    });
  }
});

/**
 * GET /api/admin/users
 * Returns paginated user accounts with privacy-safe profile details.
 */
adminRouter.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = (req.query.search as string) || undefined;
    const status = (req.query.status as string) || undefined;

    const data = await getAdminUsersList(page, limit, search, status);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[Admin API] Error fetching users:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to fetch user accounts.',
    });
  }
});

/**
 * GET /api/admin/nodes
 * Returns paginated node inventory items.
 */
adminRouter.get('/nodes', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = (req.query.search as string) || undefined;
    const status = (req.query.status as string) || undefined;

    const data = await getAdminNodesList(page, limit, status, search);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[Admin API] Error fetching nodes:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to fetch node inventory.',
    });
  }
});

/**
 * GET /api/admin/orders
 * Returns paginated node purchase orders.
 */
adminRouter.get('/orders', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = (req.query.search as string) || undefined;
    const status = (req.query.status as string) || undefined;

    const data = await getAdminOrdersList(page, limit, status, search);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[Admin API] Error fetching orders:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to fetch node orders.',
    });
  }
});

/**
 * GET /api/admin/withdrawals
 * Returns system-wide user withdrawal requests.
 */
adminRouter.get('/withdrawals', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = (req.query.search as string) || undefined;
    const status = (req.query.status as string) || undefined;

    const data = await getAdminWithdrawalsList(page, limit, status, search);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[Admin API] Error fetching withdrawals:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to fetch withdrawal requests.',
    });
  }
});

/**
 * POST /api/admin/withdrawals/settle
 * Process administrative withdrawal state machine action (APPROVE, COMPLETE, REJECT, FAIL).
 * Logs audit record upon action execution.
 */
adminRouter.post('/withdrawals/settle', async (req: AuthRequest, res: Response) => {
  try {
    const { publicId, action, rejectionReason } = req.body;

    if (!publicId || !action) {
      return res.status(400).json({
        error: 'BAD_REQUEST',
        message: 'Missing publicId or action parameter.',
      });
    }

    const adminUserId = req.user?.id || null;
    const adminPublicId = req.user?.public_id || 'SYSTEM_ADMIN';

    const updated = await settleWithdrawalAction({
      withdrawalIdOrPublicId: String(publicId),
      action: action.toUpperCase() as any,
      rejectionReason: rejectionReason ? String(rejectionReason) : undefined,
    });

    // Log admin financial audit trail
    await logAdminAction({
      adminUserId,
      adminPublicId,
      action: `WITHDRAWAL_${action.toUpperCase()}`,
      targetType: 'WITHDRAWAL',
      targetId: updated.publicWithdrawalId,
      details: `Admin ${adminPublicId} executed ${action.toUpperCase()} on withdrawal ${updated.publicWithdrawalId} ($${updated.amount.toFixed(2)} USD).`,
      metadata: {
        amount: updated.amount,
        status: updated.status,
        destinationType: updated.destinationType,
        destinationReference: updated.destinationReference,
        rejectionReason: updated.rejectionReason,
      },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip,
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
    console.error('[Admin API] Settlement error:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message });
  }
});

/**
 * GET /api/admin/transactions
 * Read-only financial ledger transactions across all users.
 */
adminRouter.get('/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = (req.query.search as string) || undefined;
    const type = (req.query.type as string) || undefined;

    const data = await getAdminTransactionsList(page, limit, type, search);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[Admin API] Error fetching transactions:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to fetch ledger transactions.',
    });
  }
});

/**
 * GET /api/admin/audit-logs
 * Returns audit log trail for administrative actions.
 */
adminRouter.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const action = (req.query.action as string) || undefined;

    const data = await getAdminAuditLogs(page, limit, action);
    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[Admin API] Error fetching audit logs:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to fetch audit logs.',
    });
  }
});
