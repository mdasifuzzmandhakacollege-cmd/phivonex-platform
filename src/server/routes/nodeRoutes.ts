import { Router, Request, Response } from 'express';
import { getDb } from '../db/db';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { GENESIS_NODE_CAP, NODE_BASE_PRICE_USD } from '../../config/nodeConfig';
import { cleanupExpiredReservations } from '../services/nodeOrderService';

const router = Router();

/**
 * GET /api/nodes/stats
 * Public endpoint returning real-time Genesis Node supply and allocation statistics derived directly from the database.
 */
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb();

    // Automatically sweep expired reservations so inventory is live and accurate
    await cleanupExpiredReservations(db);

    // Query aggregated counts by status
    const statsRes = await db.query<{ status: string; count: string | number }>(`
      SELECT 
        status, 
        COUNT(*)::int AS count 
      FROM nodes 
      GROUP BY status
    `);

    let available = 0;
    let reserved = 0;
    let active = 0;
    let retired = 0;

    for (const row of statsRes.rows) {
      const cnt = parseInt(String(row.count), 10) || 0;
      switch (row.status) {
        case 'AVAILABLE':
          available = cnt;
          break;
        case 'RESERVED':
          reserved = cnt;
          break;
        case 'ACTIVE':
          active = cnt;
          break;
        case 'RETIRED':
          retired = cnt;
          break;
      }
    }

    const allocated = reserved + active + retired;

    res.status(200).json({
      genesisCap: GENESIS_NODE_CAP,
      basePriceUsd: NODE_BASE_PRICE_USD,
      available,
      reserved,
      active,
      retired,
      allocated,
    });
  } catch (err) {
    console.error('[Node API] Error in GET /stats:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve Genesis Node statistics.',
    });
  }
});

/**
 * GET /api/nodes/me
 * Authenticated endpoint returning all Genesis Nodes owned by the current operator.
 * Safe public data only (no internal UUIDs).
 */
router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const db = await getDb();

    const nodesRes = await db.query<{
      node_number: number;
      public_node_id: string;
      status: string;
      activated_at: Date | null;
    }>(
      `
      SELECT 
        node_number,
        public_node_id,
        status,
        activated_at
      FROM nodes
      WHERE owner_user_id = $1
      ORDER BY node_number ASC
      `,
      [user.id]
    );

    const safeNodes = nodesRes.rows.map((n) => ({
      publicNodeId: n.public_node_id,
      nodeNumber: n.node_number,
      status: n.status,
      activatedAt: n.activated_at ? n.activated_at.toISOString() : null,
    }));

    res.status(200).json({
      nodes: safeNodes,
    });
  } catch (err) {
    console.error('[Node API] Error in GET /me:', err);
    res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve operator nodes.',
    });
  }
});

export default router;
