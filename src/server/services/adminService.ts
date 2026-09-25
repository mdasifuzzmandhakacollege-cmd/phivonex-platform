import { getDb } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { GENESIS_NODE_CAP } from '../../config/nodeConfig';

export interface AdminSummaryMetrics {
  totalUsers: number;
  activeUsers: number;
  genesisNodeCap: number;
  activeNodes: number;
  availableNodes: number;
  reservedNodes: number;
  retiredNodes: number;
  totalOrders: number;
  completedOrders: number;
  referralCommissionsTotal: number;
  matchingSettlementsTotal: number;
  promotionBonusesTotal: number;
  ledgerTransactionsCount: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsAmount: number;
  approvedWithdrawalsCount: number;
  approvedWithdrawalsAmount: number;
  processingWithdrawalsCount: number;
  processingWithdrawalsAmount: number;
  completedWithdrawalsCount: number;
  completedWithdrawalsTotal: number;
  rejectedWithdrawalsCount: number;
  rejectedWithdrawalsAmount: number;
  failedWithdrawalsCount: number;
  failedWithdrawalsAmount: number;
  totalWithdrawalsAmount: number;
  updatedAt: string;
}

export interface AdminUserItem {
  id: string;
  publicId: string;
  fullName: string;
  email: string;
  phone: string | null;
  country: string;
  status: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  sponsorPublicId: string | null;
  nodeCount: number;
}

export interface AdminAuditLogRecord {
  id: string;
  adminUserId: string | null;
  adminPublicId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  metadata: any;
  ipAddress: string | null;
  createdAt: string;
}

/**
 * Audit Logger: Logs every administrative action with actor identity, action type, target, and timestamp.
 */
export async function logAdminAction(params: {
  adminUserId?: string | null;
  adminPublicId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    const id = uuidv4();
    const metaStr = params.metadata ? JSON.stringify(params.metadata) : null;

    await db.query(
      `
      INSERT INTO admin_audit_logs (
        id, admin_user_id, admin_public_id, action,
        target_type, target_id, details, metadata, ip_address, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      `,
      [
        id,
        params.adminUserId || null,
        params.adminPublicId || 'SYSTEM_ADMIN',
        params.action,
        params.targetType,
        params.targetId,
        params.details,
        metaStr,
        params.ipAddress || null,
      ]
    );
  } catch (err) {
    console.error('[Admin Audit Log Error] Failed to write audit record:', err);
  }
}

/**
 * Fetch real system-wide summary metrics for the Admin Dashboard.
 */
export async function getAdminSummaryMetrics(): Promise<AdminSummaryMetrics> {
  const db = await getDb();

  const [
    usersRes,
    nodesRes,
    ordersRes,
    commissionsRes,
    matchingRes,
    promotionsRes,
    ledgerRes,
    withdrawalsRes,
  ] = await Promise.all([
    db.query(`
      SELECT 
        COUNT(*)::int AS total_users,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int AS active_users
      FROM users
    `),
    db.query(`
      SELECT 
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::int AS active_nodes,
        COUNT(CASE WHEN status = 'AVAILABLE' THEN 1 END)::int AS available_nodes,
        COUNT(CASE WHEN status = 'RESERVED' THEN 1 END)::int AS reserved_nodes,
        COUNT(CASE WHEN status = 'RETIRED' THEN 1 END)::int AS retired_nodes
      FROM nodes
    `),
    db.query(`
      SELECT 
        COUNT(*)::int AS total_orders,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int AS completed_orders
      FROM node_orders
    `),
    db.query(`
      SELECT COALESCE(SUM(amount_usd), 0)::float AS total
      FROM referral_commissions WHERE status = 'EARNED'
    `),
    db.query(`
      SELECT COALESCE(SUM(total_bonus_usd), 0)::float AS total
      FROM binary_matching_settlements WHERE status = 'COMPLETED'
    `),
    db.query(`
      SELECT COALESCE(SUM(amount_usd), 0)::float AS total
      FROM promotion_bonuses WHERE status = 'EARNED'
    `),
    db.query(`
      SELECT COUNT(*)::int AS count FROM financial_ledger_entries
    `),
    db.query(`
      SELECT 
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int AS pending_count,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END)::int AS approved_count,
        COUNT(CASE WHEN status = 'PROCESSING' THEN 1 END)::int AS processing_count,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::int AS completed_count,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END)::int AS rejected_count,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int AS failed_count,
        COALESCE(SUM(amount), 0)::float AS total_withdrawal_amount,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0)::float AS pending_amount,
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0)::float AS approved_amount,
        COALESCE(SUM(CASE WHEN status = 'PROCESSING' THEN amount ELSE 0 END), 0)::float AS processing_amount,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END), 0)::float AS completed_amount,
        COALESCE(SUM(CASE WHEN status = 'REJECTED' THEN amount ELSE 0 END), 0)::float AS rejected_amount,
        COALESCE(SUM(CASE WHEN status = 'FAILED' THEN amount ELSE 0 END), 0)::float AS failed_amount
      FROM withdrawals
    `),
  ]);

  const uRow = usersRes.rows[0] || {};
  const nRow = nodesRes.rows[0] || {};
  const oRow = ordersRes.rows[0] || {};
  const wRow = withdrawalsRes.rows[0] || {};

  return {
    totalUsers: Number(uRow.total_users || 0),
    activeUsers: Number(uRow.active_users || 0),
    genesisNodeCap: GENESIS_NODE_CAP,
    activeNodes: Number(nRow.active_nodes || 0),
    availableNodes: Number(nRow.available_nodes || 0),
    reservedNodes: Number(nRow.reserved_nodes || 0),
    retiredNodes: Number(nRow.retired_nodes || 0),
    totalOrders: Number(oRow.total_orders || 0),
    completedOrders: Number(oRow.completed_orders || 0),
    referralCommissionsTotal: Number(commissionsRes.rows[0]?.total || 0),
    matchingSettlementsTotal: Number(matchingRes.rows[0]?.total || 0),
    promotionBonusesTotal: Number(promotionsRes.rows[0]?.total || 0),
    ledgerTransactionsCount: Number(ledgerRes.rows[0]?.count || 0),
    pendingWithdrawalsCount: Number(wRow.pending_count || 0),
    pendingWithdrawalsAmount: Number(wRow.pending_amount || 0),
    approvedWithdrawalsCount: Number(wRow.approved_count || 0),
    approvedWithdrawalsAmount: Number(wRow.approved_amount || 0),
    processingWithdrawalsCount: Number(wRow.processing_count || 0),
    processingWithdrawalsAmount: Number(wRow.processing_amount || 0),
    completedWithdrawalsCount: Number(wRow.completed_count || 0),
    completedWithdrawalsTotal: Number(wRow.completed_amount || 0),
    rejectedWithdrawalsCount: Number(wRow.rejected_count || 0),
    rejectedWithdrawalsAmount: Number(wRow.rejected_amount || 0),
    failedWithdrawalsCount: Number(wRow.failed_count || 0),
    failedWithdrawalsAmount: Number(wRow.failed_amount || 0),
    totalWithdrawalsAmount: Number(wRow.total_withdrawal_amount || 0),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Fetch paginated users list with privacy-safe profile fields for Admin View.
 * Password hashes and auth secrets are strictly excluded.
 */
export async function getAdminUsersList(
  page = 1,
  limit = 20,
  search?: string,
  statusFilter?: string
): Promise<{ users: AdminUserItem[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }> {
  const db = await getDb();
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  let whereClauses = ['1=1'];
  let queryParams: any[] = [];
  let paramIdx = 1;

  if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'all') {
    whereClauses.push(`u.status = $${paramIdx}`);
    queryParams.push(statusFilter.toUpperCase());
    paramIdx++;
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    whereClauses.push(`(LOWER(u.full_name) LIKE $${paramIdx} OR LOWER(u.email) LIKE $${paramIdx} OR LOWER(u.public_id) LIKE $${paramIdx})`);
    queryParams.push(q);
    paramIdx++;
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await db.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count FROM users u WHERE ${whereSql}`,
    queryParams
  );
  const totalCount = Number(countRes.rows[0]?.count || 0);

  const txQueryParams = [...queryParams, safeLimit, offset];
  const listRes = await db.query<any>(
    `
    SELECT 
      u.id,
      u.public_id,
      u.full_name,
      u.email,
      u.phone,
      u.country,
      u.status,
      COALESCE(u.role, 'USER') AS role,
      u.email_verified_at,
      u.created_at,
      sp.public_id AS sponsor_public_id,
      (SELECT COUNT(*)::int FROM nodes n WHERE n.owner_user_id = u.id AND n.status = 'ACTIVE') AS node_count
    FROM users u
    LEFT JOIN user_referrals ur ON u.id = ur.user_id
    LEFT JOIN users sp ON ur.sponsor_user_id = sp.id
    WHERE ${whereSql}
    ORDER BY u.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
    txQueryParams
  );

  const totalPages = Math.ceil(totalCount / safeLimit) || 1;

  const users: AdminUserItem[] = listRes.rows.map((row) => ({
    id: row.id,
    publicId: row.public_id || 'PHX-USER',
    fullName: row.full_name,
    email: row.email,
    phone: row.phone || null,
    country: row.country,
    status: row.status,
    role: row.role || 'USER',
    emailVerified: !!row.email_verified_at,
    createdAt: new Date(row.created_at).toISOString(),
    sponsorPublicId: row.sponsor_public_id || null,
    nodeCount: Number(row.node_count || 0),
  }));

  return {
    users,
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages,
    },
  };
}

/**
 * Fetch paginated nodes inventory list for Admin View.
 */
export async function getAdminNodesList(
  page = 1,
  limit = 20,
  statusFilter?: string,
  search?: string
): Promise<{ nodes: any[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }> {
  const db = await getDb();
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  let whereClauses = ['1=1'];
  let queryParams: any[] = [];
  let paramIdx = 1;

  if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'all') {
    whereClauses.push(`n.status = $${paramIdx}`);
    queryParams.push(statusFilter.toUpperCase());
    paramIdx++;
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    whereClauses.push(`(LOWER(n.public_node_id) LIKE $${paramIdx} OR LOWER(u.public_id) LIKE $${paramIdx} OR LOWER(u.full_name) LIKE $${paramIdx})`);
    queryParams.push(q);
    paramIdx++;
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await db.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count FROM nodes n LEFT JOIN users u ON n.owner_user_id = u.id WHERE ${whereSql}`,
    queryParams
  );
  const totalCount = Number(countRes.rows[0]?.count || 0);

  const txQueryParams = [...queryParams, safeLimit, offset];
  const listRes = await db.query<any>(
    `
    SELECT 
      n.id,
      n.node_number,
      n.public_node_id,
      n.status,
      n.reserved_at,
      n.activated_at,
      n.created_at,
      u.public_id AS owner_public_id,
      u.full_name AS owner_name
    FROM nodes n
    LEFT JOIN users u ON n.owner_user_id = u.id
    WHERE ${whereSql}
    ORDER BY n.node_number ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
    txQueryParams
  );

  const totalPages = Math.ceil(totalCount / safeLimit) || 1;

  return {
    nodes: listRes.rows.map((r) => ({
      id: r.id,
      nodeNumber: r.node_number,
      publicNodeId: r.public_node_id,
      status: r.status,
      ownerPublicId: r.owner_public_id || null,
      ownerName: r.owner_name || null,
      reservedAt: r.reserved_at ? new Date(r.reserved_at).toISOString() : null,
      activatedAt: r.activated_at ? new Date(r.activated_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages,
    },
  };
}

/**
 * Fetch paginated node orders list for Admin View.
 */
export async function getAdminOrdersList(
  page = 1,
  limit = 20,
  statusFilter?: string,
  search?: string
): Promise<{ orders: any[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }> {
  const db = await getDb();
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  let whereClauses = ['1=1'];
  let queryParams: any[] = [];
  let paramIdx = 1;

  if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'all') {
    whereClauses.push(`o.status = $${paramIdx}`);
    queryParams.push(statusFilter.toUpperCase());
    paramIdx++;
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    whereClauses.push(`(LOWER(o.public_order_id) LIKE $${paramIdx} OR LOWER(u.public_id) LIKE $${paramIdx} OR LOWER(u.full_name) LIKE $${paramIdx})`);
    queryParams.push(q);
    paramIdx++;
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await db.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count FROM node_orders o LEFT JOIN users u ON o.user_id = u.id WHERE ${whereSql}`,
    queryParams
  );
  const totalCount = Number(countRes.rows[0]?.count || 0);

  const txQueryParams = [...queryParams, safeLimit, offset];
  const listRes = await db.query<any>(
    `
    SELECT 
      o.id,
      o.public_order_id,
      o.node_number,
      o.amount_usd,
      o.currency,
      o.status,
      o.payment_method,
      o.payment_reference,
      o.created_at,
      o.completed_at,
      u.public_id AS user_public_id,
      u.full_name AS user_name
    FROM node_orders o
    LEFT JOIN users u ON o.user_id = u.id
    WHERE ${whereSql}
    ORDER BY o.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
    txQueryParams
  );

  const totalPages = Math.ceil(totalCount / safeLimit) || 1;

  return {
    orders: listRes.rows.map((r) => ({
      id: r.id,
      publicOrderId: r.public_order_id,
      nodeNumber: r.node_number,
      amountUsd: Number(r.amount_usd),
      currency: r.currency,
      status: r.status,
      paymentMethod: r.payment_method,
      paymentReference: r.payment_reference,
      userPublicId: r.user_public_id || null,
      userName: r.user_name || null,
      createdAt: new Date(r.created_at).toISOString(),
      completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages,
    },
  };
}

/**
 * Fetch system-wide withdrawals list for Admin View.
 */
export async function getAdminWithdrawalsList(
  page = 1,
  limit = 20,
  statusFilter?: string,
  search?: string
): Promise<{ withdrawals: any[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }> {
  const db = await getDb();
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  let whereClauses = ['1=1'];
  let queryParams: any[] = [];
  let paramIdx = 1;

  if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'all') {
    whereClauses.push(`w.status = $${paramIdx}`);
    queryParams.push(statusFilter.toUpperCase());
    paramIdx++;
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    whereClauses.push(`(LOWER(w.public_withdrawal_id) LIKE $${paramIdx} OR LOWER(u.public_id) LIKE $${paramIdx} OR LOWER(u.full_name) LIKE $${paramIdx} OR LOWER(w.destination_reference) LIKE $${paramIdx})`);
    queryParams.push(q);
    paramIdx++;
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await db.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count FROM withdrawals w LEFT JOIN users u ON w.user_id = u.id WHERE ${whereSql}`,
    queryParams
  );
  const totalCount = Number(countRes.rows[0]?.count || 0);

  const txQueryParams = [...queryParams, safeLimit, offset];
  const listRes = await db.query<any>(
    `
    SELECT 
      w.*,
      u.public_id AS user_public_id,
      u.full_name AS user_name,
      u.email AS user_email
    FROM withdrawals w
    LEFT JOIN users u ON w.user_id = u.id
    WHERE ${whereSql}
    ORDER BY w.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
    txQueryParams
  );

  const totalPages = Math.ceil(totalCount / safeLimit) || 1;

  return {
    withdrawals: listRes.rows.map((r) => ({
      id: r.id,
      publicWithdrawalId: r.public_withdrawal_id,
      userId: r.user_id,
      userPublicId: r.user_public_id || 'PHX-USER',
      userName: r.user_name || 'Operator',
      userEmail: r.user_email || '',
      amount: Number(r.amount),
      currency: r.currency,
      destinationType: r.destination_type,
      destinationReference: r.destination_reference,
      status: r.status,
      requestedAt: r.requested_at ? new Date(r.requested_at).toISOString() : new Date(r.created_at).toISOString(),
      approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : null,
      rejectedAt: r.rejected_at ? new Date(r.rejected_at).toISOString() : null,
      completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
      cancelledAt: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : null,
      failedAt: r.failed_at ? new Date(r.failed_at).toISOString() : null,
      rejectionReason: r.rejection_reason || null,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date(r.created_at).toISOString(),
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages,
    },
  };
}

/**
 * Fetch read-only financial ledger transactions across all users for Admin Ledger Explorer.
 */
export async function getAdminTransactionsList(
  page = 1,
  limit = 20,
  typeFilter?: string,
  search?: string
): Promise<{ transactions: any[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }> {
  const db = await getDb();
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  let whereClauses = ['1=1'];
  let queryParams: any[] = [];
  let paramIdx = 1;

  if (typeFilter && typeFilter !== 'ALL' && typeFilter !== 'all') {
    whereClauses.push(`f.source_type = $${paramIdx}`);
    queryParams.push(typeFilter.toUpperCase());
    paramIdx++;
  }

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    whereClauses.push(`(LOWER(f.public_txn_id) LIKE $${paramIdx} OR LOWER(u.public_id) LIKE $${paramIdx} OR LOWER(f.description) LIKE $${paramIdx} OR LOWER(f.source_ref) LIKE $${paramIdx})`);
    queryParams.push(q);
    paramIdx++;
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await db.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count FROM financial_ledger_entries f LEFT JOIN users u ON f.user_id = u.id WHERE ${whereSql}`,
    queryParams
  );
  const totalCount = Number(countRes.rows[0]?.count || 0);

  const txQueryParams = [...queryParams, safeLimit, offset];
  const listRes = await db.query<any>(
    `
    SELECT 
      f.*,
      u.public_id AS user_public_id,
      u.full_name AS user_name
    FROM financial_ledger_entries f
    LEFT JOIN users u ON f.user_id = u.id
    WHERE ${whereSql}
    ORDER BY f.created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
    txQueryParams
  );

  const totalPages = Math.ceil(totalCount / safeLimit) || 1;

  return {
    transactions: listRes.rows.map((r) => ({
      id: r.id,
      publicTxnId: r.public_txn_id,
      userId: r.user_id,
      userPublicId: r.user_public_id || 'PHX-USER',
      userName: r.user_name || 'Operator',
      entryType: r.entry_type,
      sourceType: r.source_type,
      sourceId: r.source_id,
      sourceRef: r.source_ref,
      description: r.description,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages,
    },
  };
}

/**
 * Fetch admin audit action logs.
 */
export async function getAdminAuditLogs(
  page = 1,
  limit = 20,
  actionFilter?: string
): Promise<{ logs: AdminAuditLogRecord[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }> {
  const db = await getDb();
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  let whereClauses = ['1=1'];
  let queryParams: any[] = [];
  let paramIdx = 1;

  if (actionFilter && actionFilter !== 'ALL' && actionFilter !== 'all') {
    whereClauses.push(`action = $${paramIdx}`);
    queryParams.push(actionFilter.toUpperCase());
    paramIdx++;
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await db.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count FROM admin_audit_logs WHERE ${whereSql}`,
    queryParams
  );
  const totalCount = Number(countRes.rows[0]?.count || 0);

  const txQueryParams = [...queryParams, safeLimit, offset];
  const listRes = await db.query<any>(
    `
    SELECT * FROM admin_audit_logs
    WHERE ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
    txQueryParams
  );

  const totalPages = Math.ceil(totalCount / safeLimit) || 1;

  const logs: AdminAuditLogRecord[] = listRes.rows.map((r) => ({
    id: r.id,
    adminUserId: r.admin_user_id || null,
    adminPublicId: r.admin_public_id || 'SYSTEM_ADMIN',
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    details: r.details,
    metadata: r.metadata ? JSON.parse(r.metadata) : null,
    ipAddress: r.ip_address || null,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  return {
    logs,
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages,
    },
  };
}
