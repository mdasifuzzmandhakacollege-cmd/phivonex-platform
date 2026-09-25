import { getDb } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { generateWithdrawalPublicId } from '../utils/idGenerator';
import { getWalletSummary, postLedgerDebit, postLedgerReversal } from './walletLedgerService';
import { notifyWithdrawalStatus } from './notificationService';

export type WithdrawalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface WithdrawalRecord {
  id: string;
  publicWithdrawalId: string;
  userId: string;
  amount: number;
  currency: string;
  destinationType: string;
  destinationReference: string;
  status: WithdrawalStatus;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  failedAt: string | null;
  rejectionReason: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawalHistoryResponse {
  withdrawals: WithdrawalRecord[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

function mapRowToWithdrawalRecord(row: any): WithdrawalRecord {
  return {
    id: row.id,
    publicWithdrawalId: row.public_withdrawal_id,
    userId: row.user_id,
    amount: Number(row.amount),
    currency: row.currency || 'USD',
    destinationType: row.destination_type,
    destinationReference: row.destination_reference,
    status: row.status as WithdrawalStatus,
    requestedAt: row.requested_at ? new Date(row.requested_at).toISOString() : new Date(row.created_at).toISOString(),
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
    failedAt: row.failed_at ? new Date(row.failed_at).toISOString() : null,
    rejectionReason: row.rejection_reason || null,
    idempotencyKey: row.idempotency_key || null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const userLocks = new Map<string, Promise<any>>();

function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const previousLock = userLocks.get(userId) || Promise.resolve();
  const res = previousLock.then(
    () => fn(),
    () => fn()
  );
  userLocks.set(userId, res.catch(() => {}));
  return res;
}

/**
 * Request a new withdrawal from the user's available ledger balance.
 * Validates available balance, reserves funds via ledger DEBIT entry, and enforces duplicate protection.
 */
export async function createWithdrawalRequest(params: {
  userId: string;
  amount: number;
  destinationType: string;
  destinationReference: string;
  idempotencyKey?: string;
}): Promise<WithdrawalRecord> {
  return withUserLock(params.userId, async () => {
    const { userId, amount, destinationType, destinationReference, idempotencyKey } = params;

    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new Error('INVALID_AMOUNT: Withdrawal amount must be a positive number greater than 0.');
    }

    const cleanAmount = Math.round(amount * 100) / 100;
    if (cleanAmount < 10.00) {
      throw new Error('MINIMUM_AMOUNT_LIMIT: Minimum withdrawal amount is $10.00.');
    }

    if (!destinationType || !destinationType.trim()) {
      throw new Error('INVALID_DESTINATION_TYPE: Destination type is required.');
    }

    if (!destinationReference || !destinationReference.trim()) {
      throw new Error('INVALID_DESTINATION_REF: Destination address or reference details are required.');
    }

    const db = await getDb();

    // 1. Check idempotency key if provided
    const cleanIdempotencyKey = idempotencyKey ? idempotencyKey.trim() : null;
    if (cleanIdempotencyKey) {
      const existing = await db.query(
        `SELECT * FROM withdrawals WHERE user_id = $1 AND idempotency_key = $2`,
        [userId, cleanIdempotencyKey]
      );
      if (existing.rows.length > 0) {
        return mapRowToWithdrawalRecord(existing.rows[0]);
      }
    }

    // 2. Duplicate submission protection (prevent same amount & destination within 5 seconds)
    const recentDuplicate = await db.query(
      `
      SELECT * FROM withdrawals
      WHERE user_id = $1
        AND amount = $2
        AND destination_reference = $3
        AND status = 'PENDING'
        AND created_at > NOW() - INTERVAL '5 seconds'
      `,
      [userId, cleanAmount, destinationReference.trim()]
    );

    if (recentDuplicate.rows.length > 0) {
      return mapRowToWithdrawalRecord(recentDuplicate.rows[0]);
    }

    // 3. Balance Validation & Reservation (Authoritative Server Check)
    const walletSummary = await getWalletSummary(userId);
    if (cleanAmount > walletSummary.availableBalance) {
      const err = new Error(
        `INSUFFICIENT_BALANCE: Requested withdrawal amount ($${cleanAmount.toFixed(2)}) exceeds available eligible ledger balance ($${walletSummary.availableBalance.toFixed(2)}).`
      );
      (err as any).code = 'INSUFFICIENT_BALANCE';
      (err as any).availableBalance = walletSummary.availableBalance;
      throw err;
    }

    const id = uuidv4();
    const publicWithdrawalId = generateWithdrawalPublicId();
    const now = new Date();

    // 4. Create Withdrawal Record
    const insertRes = await db.query(
      `
      INSERT INTO withdrawals (
        id, public_withdrawal_id, user_id, amount, currency,
        destination_type, destination_reference, status,
        requested_at, idempotency_key, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, 'USD', $5, $6, 'PENDING', $7, $8, $7, $7)
      RETURNING *
      `,
      [
        id,
        publicWithdrawalId,
        userId,
        cleanAmount,
        destinationType.trim(),
        destinationReference.trim(),
        now,
        cleanIdempotencyKey,
      ]
    );

    const withdrawal = mapRowToWithdrawalRecord(insertRes.rows[0]);

    // 5. Reserve balance immediately by posting a DEBIT entry in the financial ledger
    await postLedgerDebit({
      userId,
      sourceType: 'WITHDRAWAL',
      sourceId: withdrawal.id,
      sourceRef: withdrawal.publicWithdrawalId,
      amount: cleanAmount,
      description: `Withdrawal Request - ${withdrawal.destinationType} (${withdrawal.destinationReference.slice(0, 12)}...)`,
      createdAt: now,
    });

    // Task #20: Trigger in-app notification for withdrawal submission
    try {
      await notifyWithdrawalStatus({
        userId,
        amountUsdt: cleanAmount,
        status: 'PENDING',
        withdrawalId: withdrawal.id,
      });
    } catch (notifErr) {
      console.warn('[Notification] Error triggering withdrawal pending notification:', notifErr);
    }

    return withdrawal;
  });
}

/**
 * Get paginated withdrawal history for a user.
 */
export async function getUserWithdrawals(
  userId: string,
  page = 1,
  limit = 20,
  statusFilter?: string
): Promise<WithdrawalHistoryResponse> {
  const db = await getDb();
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  let whereClauses = ['user_id = $1'];
  let queryParams: any[] = [userId];
  let paramIdx = 2;

  if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'all') {
    whereClauses.push(`status = $${paramIdx}`);
    queryParams.push(statusFilter.toUpperCase());
    paramIdx++;
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await db.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count FROM withdrawals WHERE ${whereSql}`,
    queryParams
  );
  const totalCount = Number(countRes.rows[0]?.count || 0);

  const txQueryParams = [...queryParams, safeLimit, offset];
  const listRes = await db.query(
    `
    SELECT * FROM withdrawals
    WHERE ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
    txQueryParams
  );

  const totalPages = Math.ceil(totalCount / safeLimit) || 1;
  const withdrawals = listRes.rows.map(mapRowToWithdrawalRecord);

  return {
    withdrawals,
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages,
    },
  };
}

/**
 * Get a single withdrawal record by public withdrawal ID with user ownership check.
 */
export async function getWithdrawalByPublicId(
  publicId: string,
  userId?: string
): Promise<WithdrawalRecord | null> {
  const db = await getDb();
  let res;
  if (userId) {
    res = await db.query(
      `SELECT * FROM withdrawals WHERE (public_withdrawal_id = $1 OR id::text = $1) AND user_id = $2`,
      [publicId, userId]
    );
  } else {
    res = await db.query(
      `SELECT * FROM withdrawals WHERE public_withdrawal_id = $1 OR id::text = $1`,
      [publicId]
    );
  }

  if (res.rows.length === 0) return null;
  return mapRowToWithdrawalRecord(res.rows[0]);
}

/**
 * Allow a user to cancel their own PENDING withdrawal request.
 * Releases reserved funds by posting a REVERSAL entry into the ledger.
 */
export async function cancelWithdrawalRequest(
  publicId: string,
  userId: string
): Promise<WithdrawalRecord> {
  const withdrawal = await getWithdrawalByPublicId(publicId, userId);
  if (!withdrawal) {
    throw new Error('NOT_FOUND: Withdrawal request not found.');
  }

  if (withdrawal.status !== 'PENDING') {
    throw new Error(`INVALID_STATE: Only PENDING withdrawals can be cancelled. Current status is ${withdrawal.status}.`);
  }

  const db = await getDb();
  const now = new Date();

  const updateRes = await db.query(
    `
    UPDATE withdrawals
    SET status = 'CANCELLED', cancelled_at = $1, updated_at = $1
    WHERE id = $2 AND status = 'PENDING'
    RETURNING *
    `,
    [now, withdrawal.id]
  );

  if (updateRes.rows.length === 0) {
    throw new Error('CONCURRENCY_ERROR: Withdrawal status was updated concurrently.');
  }

  const updatedWithdrawal = mapRowToWithdrawalRecord(updateRes.rows[0]);

  // Release reserved funds back to available ledger balance
  await postLedgerReversal({
    userId,
    sourceType: 'WITHDRAWAL',
    sourceId: updatedWithdrawal.id,
    sourceRef: updatedWithdrawal.publicWithdrawalId,
    amount: updatedWithdrawal.amount,
    description: `Withdrawal Cancelled - Funds Released (${updatedWithdrawal.publicWithdrawalId})`,
    createdAt: now,
  });

  return updatedWithdrawal;
}

/**
 * Admin/Internal Settlement State Machine Processor.
 * Actions: APPROVE, COMPLETE, REJECT, FAIL.
 * Releases reserved funds on REJECT/FAIL; enforces single completion.
 */
export async function settleWithdrawalAction(params: {
  withdrawalIdOrPublicId: string;
  action: 'APPROVE' | 'COMPLETE' | 'REJECT' | 'FAIL' | 'MARK_PROCESSING' | 'PROCESSING';
  rejectionReason?: string;
}): Promise<WithdrawalRecord> {
  const { withdrawalIdOrPublicId, action, rejectionReason } = params;

  const withdrawal = await getWithdrawalByPublicId(withdrawalIdOrPublicId);
  if (!withdrawal) {
    throw new Error('NOT_FOUND: Withdrawal record not found.');
  }

  const db = await getDb();
  const now = new Date();
  const normalizedAction = action.toUpperCase();

  if (normalizedAction === 'APPROVE') {
    if (withdrawal.status !== 'PENDING') {
      throw new Error(`INVALID_STATE: Cannot APPROVE withdrawal in status ${withdrawal.status}. Must be PENDING.`);
    }

    const res = await db.query(
      `
      UPDATE withdrawals
      SET status = 'APPROVED', approved_at = $1, updated_at = $1
      WHERE id = $2 AND status = 'PENDING'
      RETURNING *
      `,
      [now, withdrawal.id]
    );

    if (res.rows.length === 0) throw new Error('CONCURRENCY_ERROR: Status changed concurrently.');
    const approvedRec = mapRowToWithdrawalRecord(res.rows[0]);
    try {
      await notifyWithdrawalStatus({
        userId: approvedRec.userId,
        amountUsdt: approvedRec.amount,
        status: 'APPROVED',
        withdrawalId: approvedRec.id,
      });
    } catch (notifErr) {
      console.warn('[Notification] Error triggering withdrawal approved notification:', notifErr);
    }
    return approvedRec;
  }

  if (normalizedAction === 'MARK_PROCESSING' || normalizedAction === 'PROCESSING') {
    if (withdrawal.status !== 'PENDING' && withdrawal.status !== 'APPROVED') {
      throw new Error(`INVALID_STATE: Cannot transition withdrawal to PROCESSING from status ${withdrawal.status}. Must be PENDING or APPROVED.`);
    }

    const res = await db.query(
      `
      UPDATE withdrawals
      SET status = 'PROCESSING', updated_at = $1
      WHERE id = $2 AND status IN ('PENDING', 'APPROVED')
      RETURNING *
      `,
      [now, withdrawal.id]
    );

    if (res.rows.length === 0) throw new Error('CONCURRENCY_ERROR: Status changed concurrently.');
    return mapRowToWithdrawalRecord(res.rows[0]);
  }

  if (normalizedAction === 'COMPLETE') {
    if (withdrawal.status !== 'APPROVED' && withdrawal.status !== 'PROCESSING' && withdrawal.status !== 'PENDING') {
      throw new Error(`INVALID_STATE: Cannot COMPLETE withdrawal in status ${withdrawal.status}. Must be PENDING, APPROVED, or PROCESSING.`);
    }

    const res = await db.query(
      `
      UPDATE withdrawals
      SET status = 'COMPLETED', completed_at = $1, updated_at = $1
      WHERE id = $2 AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
      RETURNING *
      `,
      [now, withdrawal.id]
    );

    if (res.rows.length === 0) throw new Error('CONCURRENCY_ERROR: Withdrawal was already processed or cancelled.');
    const completedRec = mapRowToWithdrawalRecord(res.rows[0]);
    try {
      await notifyWithdrawalStatus({
        userId: completedRec.userId,
        amountUsdt: completedRec.amount,
        status: 'COMPLETED',
        withdrawalId: completedRec.id,
      });
    } catch (notifErr) {
      console.warn('[Notification] Error triggering withdrawal completed notification:', notifErr);
    }
    return completedRec;
  }

  if (normalizedAction === 'REJECT') {
    if (withdrawal.status === 'COMPLETED' || withdrawal.status === 'REJECTED' || withdrawal.status === 'CANCELLED' || withdrawal.status === 'FAILED') {
      throw new Error(`INVALID_STATE: Cannot REJECT withdrawal in status ${withdrawal.status}.`);
    }

    const reason = rejectionReason || 'Administrative rejection';

    const res = await db.query(
      `
      UPDATE withdrawals
      SET status = 'REJECTED', rejected_at = $1, rejection_reason = $2, updated_at = $1
      WHERE id = $3 AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
      RETURNING *
      `,
      [now, reason, withdrawal.id]
    );

    if (res.rows.length === 0) throw new Error('CONCURRENCY_ERROR: Status changed concurrently.');
    const updated = mapRowToWithdrawalRecord(res.rows[0]);

    // Release reserved funds
    await postLedgerReversal({
      userId: updated.userId,
      sourceType: 'WITHDRAWAL',
      sourceId: updated.id,
      sourceRef: updated.publicWithdrawalId,
      amount: updated.amount,
      description: `Withdrawal Rejected - Funds Released (${updated.publicWithdrawalId})`,
      createdAt: now,
    });

    try {
      await notifyWithdrawalStatus({
        userId: updated.userId,
        amountUsdt: updated.amount,
        status: 'REJECTED',
        withdrawalId: updated.id,
        reason,
      });
    } catch (notifErr) {
      console.warn('[Notification] Error triggering withdrawal rejected notification:', notifErr);
    }

    return updated;
  }

  if (normalizedAction === 'FAIL') {
    if (withdrawal.status === 'COMPLETED' || withdrawal.status === 'FAILED' || withdrawal.status === 'CANCELLED' || withdrawal.status === 'REJECTED') {
      throw new Error(`INVALID_STATE: Cannot FAIL withdrawal in status ${withdrawal.status}.`);
    }

    const reason = rejectionReason || 'Settlement transfer failed';

    const res = await db.query(
      `
      UPDATE withdrawals
      SET status = 'FAILED', failed_at = $1, rejection_reason = $2, updated_at = $1
      WHERE id = $3 AND status IN ('PENDING', 'APPROVED', 'PROCESSING')
      RETURNING *
      `,
      [now, reason, withdrawal.id]
    );

    if (res.rows.length === 0) throw new Error('CONCURRENCY_ERROR: Status changed concurrently.');
    const updated = mapRowToWithdrawalRecord(res.rows[0]);

    // Release reserved funds
    await postLedgerReversal({
      userId: updated.userId,
      sourceType: 'WITHDRAWAL',
      sourceId: updated.id,
      sourceRef: updated.publicWithdrawalId,
      amount: updated.amount,
      description: `Withdrawal Transfer Failed - Funds Released (${updated.publicWithdrawalId})`,
      createdAt: now,
    });

    return updated;
  }

  throw new Error(`INVALID_ACTION: Unknown settlement action ${action}`);
}
