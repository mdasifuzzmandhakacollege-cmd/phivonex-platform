import { getDb } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { BSC_CONFIG } from '../../config/bscConfig';
import { generateDepositPublicId } from '../utils/idGenerator';
import { findUserByDepositAddress } from './bscKeyService';
import { postLedgerCredit } from './walletLedgerService';
import { notifyUsdtDepositConfirmed } from './notificationService';

export type BlockchainDepositStatus =
  | 'DETECTED'
  | 'CONFIRMING'
  | 'CONFIRMED'
  | 'CREDITED'
  | 'REORGED'
  | 'FAILED';

export interface BlockchainDepositRecord {
  id: string;
  publicDepositId: string;
  userId: string;
  chainId: number;
  asset: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  blockNumber: number;
  confirmations: number;
  status: BlockchainDepositStatus;
  detectedAt: string;
  confirmedAt: string | null;
  creditedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserDepositsResponse {
  deposits: BlockchainDepositRecord[];
  summary: {
    totalCreditedBnb: number;
    totalPendingBnb: number;
    depositCount: number;
    requiredConfirmations: number;
    chainId: number;
    networkName: string;
  };
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

function mapRowToDepositRecord(row: any): BlockchainDepositRecord {
  return {
    id: row.id,
    publicDepositId: row.public_deposit_id,
    userId: row.user_id,
    chainId: Number(row.chain_id),
    asset: row.asset || 'BNB',
    txHash: row.tx_hash,
    fromAddress: row.from_address,
    toAddress: row.to_address,
    amount: Number(row.amount),
    blockNumber: Number(row.block_number),
    confirmations: Number(row.confirmations || 0),
    status: row.status as BlockchainDepositStatus,
    detectedAt: row.detected_at ? new Date(row.detected_at).toISOString() : new Date(row.created_at).toISOString(),
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : null,
    creditedAt: row.credited_at ? new Date(row.credited_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

// Deposit processing lock to prevent race conditions during block ingestion
const depositLocks = new Map<string, Promise<any>>();

function withDepositLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previousLock = depositLocks.get(key) || Promise.resolve();
  const res = previousLock.then(
    () => fn(),
    () => fn()
  );
  depositLocks.set(key, res.catch(() => {}));
  return res;
}

/**
 * Ingest or update an on-chain BNB deposit event.
 * 
 * AUTOMATIC WORKFLOW:
 * 1. Validates recipient is a known PHIVONEX deposit address.
 * 2. If new: creates record with DETECTED / CONFIRMING status.
 * 3. If confirmations >= REQUIRED_CONFIRMATIONS: transitions to CONFIRMED.
 * 4. Automatically posts native BNB CREDIT to financial ledger and marks CREDITED.
 * 5. Strict idempotency prevents duplicate credits on repeated block scans / restarts.
 */
export async function processBlockchainDepositEvent(params: {
  chainId?: number;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  blockNumber: number;
  currentBlockNumber: number;
}): Promise<BlockchainDepositRecord | null> {
  const chainId = params.chainId || BSC_CONFIG.CHAIN_ID;
  const cleanTxHash = params.txHash.toLowerCase().trim();
  const cleanFromAddress = params.fromAddress.toLowerCase().trim();
  const cleanToAddress = params.toAddress.toLowerCase().trim();
  const amount = Number(params.amount);
  const blockNumber = Number(params.blockNumber);
  const currentBlockNumber = Number(params.currentBlockNumber);

  if (!cleanTxHash || !cleanToAddress || isNaN(amount) || amount <= 0) {
    return null;
  }

  const lockKey = `${chainId}:${cleanTxHash}:${cleanToAddress}`;

  return withDepositLock(lockKey, async () => {
    const db = await getDb();

    // 1. Resolve user by toAddress
    const userId = await findUserByDepositAddress(cleanToAddress, chainId);
    if (!userId) {
      // Not a PHIVONEX deposit address: ignore safely
      return null;
    }

    // 2. Compute current confirmations
    const confirmations = Math.max(0, currentBlockNumber - blockNumber + 1);
    const requiredConfs = BSC_CONFIG.REQUIRED_CONFIRMATIONS;
    const isMatured = confirmations >= requiredConfs;

    // 3. Check if deposit record already exists
    const existing = await db.query(
      `
      SELECT * FROM blockchain_deposits
      WHERE chain_id = $1 AND LOWER(tx_hash) = $2 AND LOWER(to_address) = $3
      `,
      [chainId, cleanTxHash, cleanToAddress]
    );

    let depositRow: any;
    const now = new Date();

    if (existing.rows.length === 0) {
      // First detection of deposit
      const id = uuidv4();
      const publicDepositId = generateDepositPublicId();
      const initialStatus: BlockchainDepositStatus = isMatured ? 'CONFIRMED' : (confirmations > 0 ? 'CONFIRMING' : 'DETECTED');
      const confirmedAt = isMatured ? now : null;

      const insertRes = await db.query(
        `
        INSERT INTO blockchain_deposits (
          id, public_deposit_id, user_id, chain_id, asset,
          tx_hash, from_address, to_address, amount, block_number,
          confirmations, status, detected_at, confirmed_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, 'BNB', $5, $6, $7, $8, $9, $10, $11, $12, $13, $12, $12)
        ON CONFLICT (chain_id, tx_hash, to_address) DO UPDATE
          SET confirmations = EXCLUDED.confirmations,
              updated_at = CURRENT_TIMESTAMP
        RETURNING *
        `,
        [
          id,
          publicDepositId,
          userId,
          chainId,
          cleanTxHash,
          cleanFromAddress,
          cleanToAddress,
          amount,
          blockNumber,
          confirmations,
          initialStatus,
          now,
          confirmedAt,
        ]
      );

      depositRow = insertRes.rows[0];
    } else {
      depositRow = existing.rows[0];

      // If already CREDITED or FAILED or REORGED, simply update confirmations counter
      if (depositRow.status === 'CREDITED' || depositRow.status === 'REORGED' || depositRow.status === 'FAILED') {
        const updateRes = await db.query(
          `
          UPDATE blockchain_deposits
          SET confirmations = $1, updated_at = $2
          WHERE id = $3
          RETURNING *
          `,
          [confirmations, now, depositRow.id]
        );
        return mapRowToWithdrawalOrDeposit(updateRes.rows[0] || depositRow);
      }

      // If advancing confirmations
      let nextStatus: BlockchainDepositStatus = depositRow.status;
      let confirmedAt = depositRow.confirmed_at;

      if (isMatured) {
        nextStatus = 'CONFIRMED';
        if (!confirmedAt) confirmedAt = now;
      } else if (confirmations > 0 && nextStatus === 'DETECTED') {
        nextStatus = 'CONFIRMING';
      }

      const updateRes = await db.query(
        `
        UPDATE blockchain_deposits
        SET confirmations = $1,
            status = $2,
            confirmed_at = COALESCE(confirmed_at, $3),
            updated_at = $4
        WHERE id = $5
        RETURNING *
        `,
        [confirmations, nextStatus, confirmedAt, now, depositRow.id]
      );

      depositRow = updateRes.rows[0];
    }

    // 4. Automatic Ledger Credit if CONFIRMED and not yet CREDITED
    if ((depositRow.status === 'CONFIRMED' || isMatured) && depositRow.status !== 'CREDITED') {
      const publicDepId = depositRow.public_deposit_id;
      const depId = depositRow.id;
      const depAmount = Number(depositRow.amount);

      // Post native BNB credit to financial ledger (idempotent via unique constraint)
      await postLedgerCredit({
        userId,
        sourceType: 'BLOCKCHAIN_DEPOSIT' as any,
        sourceId: depId,
        sourceRef: publicDepId,
        amount: depAmount,
        description: `BNB Smart Chain Deposit (${cleanTxHash.slice(0, 10)}... to ${cleanToAddress.slice(0, 8)}...)`,
        createdAt: depositRow.confirmed_at ? new Date(depositRow.confirmed_at) : now,
      });

      // Update deposit status to CREDITED
      const creditedRes = await db.query(
        `
        UPDATE blockchain_deposits
        SET status = 'CREDITED',
            credited_at = $1,
            updated_at = $1
        WHERE id = $2
        RETURNING *
        `,
        [now, depId]
      );

      if (creditedRes.rows.length > 0) {
        depositRow = creditedRes.rows[0];
      }

      // Task #20: Trigger in-app notification for confirmed blockchain deposit
      try {
        await notifyUsdtDepositConfirmed({
          userId,
          amountUsdt: depAmount,
          depositId: depId,
          txHash: cleanTxHash,
        });
      } catch (notifErr) {
        console.warn('[Notification] Error triggering deposit confirmed notification:', notifErr);
      }
    }

    return mapRowToDepositRecord(depositRow);
  });
}

function mapRowToWithdrawalOrDeposit(row: any): BlockchainDepositRecord {
  return mapRowToDepositRecord(row);
}

/**
 * Handle chain reorganization (reorg).
 * If a previously detected unfinalized transaction is absent/reorged from the canonical chain:
 * Transitions status to REORGED and preserves complete audit trail.
 */
export async function handleDepositReorg(params: {
  chainId?: number;
  txHash: string;
  toAddress: string;
  reason?: string;
}): Promise<BlockchainDepositRecord | null> {
  const chainId = params.chainId || BSC_CONFIG.CHAIN_ID;
  const cleanTxHash = params.txHash.toLowerCase().trim();
  const cleanToAddress = params.toAddress.toLowerCase().trim();

  const db = await getDb();
  const existing = await db.query(
    `
    SELECT * FROM blockchain_deposits
    WHERE chain_id = $1 AND LOWER(tx_hash) = $2 AND LOWER(to_address) = $3
    `,
    [chainId, cleanTxHash, cleanToAddress]
  );

  if (existing.rows.length === 0) return null;
  const row = existing.rows[0];

  if (row.status === 'CREDITED') {
    // If already finalized and credited, maintain safety and record audit event
    console.warn(`[REORG SAFETY] Alert: Deposit ${row.public_deposit_id} was already CREDITED before reorg detection.`);
    return mapRowToDepositRecord(row);
  }

  const now = new Date();
  const res = await db.query(
    `
    UPDATE blockchain_deposits
    SET status = 'REORGED', updated_at = $1
    WHERE id = $2 AND status IN ('DETECTED', 'CONFIRMING')
    RETURNING *
    `,
    [now, row.id]
  );

  return res.rows.length > 0 ? mapRowToDepositRecord(res.rows[0]) : mapRowToDepositRecord(row);
}

/**
 * Get paginated deposits for a specific user.
 */
export async function getUserDeposits(
  userId: string,
  page = 1,
  limit = 20,
  statusFilter?: string
): Promise<UserDepositsResponse> {
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
    `SELECT COUNT(*)::int AS count FROM blockchain_deposits WHERE ${whereSql}`,
    queryParams
  );
  const totalCount = Number(countRes.rows[0]?.count || 0);

  const txQueryParams = [...queryParams, safeLimit, offset];
  const listRes = await db.query(
    `
    SELECT * FROM blockchain_deposits
    WHERE ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `,
    txQueryParams
  );

  // Summary aggregation
  const summaryRes = await db.query<{
    total_credited: string | number;
    total_pending: string | number;
    deposit_count: string | number;
  }>(
    `
    SELECT
      COALESCE(SUM(CASE WHEN status = 'CREDITED' THEN amount ELSE 0 END), 0) AS total_credited,
      COALESCE(SUM(CASE WHEN status IN ('DETECTED', 'CONFIRMING', 'CONFIRMED') THEN amount ELSE 0 END), 0) AS total_pending,
      COUNT(*)::int AS deposit_count
    FROM blockchain_deposits
    WHERE user_id = $1
    `,
    [userId]
  );

  const summaryRow = summaryRes.rows[0] || { total_credited: 0, total_pending: 0, deposit_count: 0 };
  const totalPages = Math.ceil(totalCount / safeLimit) || 1;

  return {
    deposits: listRes.rows.map(mapRowToDepositRecord),
    summary: {
      totalCreditedBnb: Number(summaryRow.total_credited || 0),
      totalPendingBnb: Number(summaryRow.total_pending || 0),
      depositCount: Number(summaryRow.deposit_count || 0),
      requiredConfirmations: BSC_CONFIG.REQUIRED_CONFIRMATIONS,
      chainId: BSC_CONFIG.CHAIN_ID,
      networkName: BSC_CONFIG.NETWORK_NAME,
    },
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages,
    },
  };
}
