import { getDb } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { generateLedgerTransactionPublicId } from '../utils/idGenerator';
import { getNodeBasePrice, getBnbPriceUsd } from './economicService';
import { createNodeReservation, settleNodeOrder, getUserOrders } from './nodeOrderService';
import { getWalletSummary } from './walletLedgerService';

export interface AssetBalanceInfo {
  available: number;
  required: number;
  sufficient: boolean;
  missing: number;
}

export interface NodeBalanceValidationResult {
  userId: string;
  nodePriceUsd: number;
  bnbPriceUsd: number | null;
  bnbRequired: number;
  usdtRequired: number;
  usdtBalance: AssetBalanceInfo;
  bnbBalance: AssetBalanceInfo;
  canActivateWithUsdt: boolean;
  canActivateWithBnb: boolean;
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
 * Validates the authenticated user's internal deposit balances (BNB & USDT)
 * specifically for Genesis Node activation eligibility.
 */
export async function validateUserNodePurchaseBalances(
  userId: string
): Promise<NodeBalanceValidationResult> {
  const db = await getDb();

  // 1. Get Node Price & BNB Price from authoritative economic service
  const nodePriceUsd = await getNodeBasePrice(); // e.g. 1000
  const bnbPriceUsd = await getBnbPriceUsd(); // e.g. 450 or null if unconfigured
  const bnbRequired = bnbPriceUsd && bnbPriceUsd > 0 ? Number((nodePriceUsd / bnbPriceUsd).toFixed(4)) : 0;
  const usdtRequired = nodePriceUsd;

  // 2. Compute unified USDT Available Balance (Deposits + Earnings - Debits)
  const walletSummary = await getWalletSummary(userId);
  const availableUsdt = walletSummary.availableBalance;

  // 3. Compute BNB Credited Deposits vs Node Purchase Debits
  const bnbDepositsRes = await db.query<{ total: string | number }>(
    `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM blockchain_deposits
    WHERE user_id = $1 AND status = 'CREDITED' AND asset = 'BNB'
    `,
    [userId]
  );
  const totalBnbDeposits = Number(bnbDepositsRes.rows[0]?.total || 0);

  const bnbDebitsRes = await db.query<{ total: string | number }>(
    `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM financial_ledger_entries
    WHERE user_id = $1 AND entry_type = 'DEBIT' AND source_type = 'NODE_PURCHASE' AND currency = 'BNB'
    `,
    [userId]
  );
  const totalBnbDebits = Number(bnbDebitsRes.rows[0]?.total || 0);
  const availableBnb = Math.max(0, totalBnbDeposits - totalBnbDebits);

  // 4. Balance sufficiency checks (BNB purchases blocked if BNB valuation rate is unconfigured)
  const usdtSufficient = availableUsdt >= usdtRequired;
  const bnbSufficient = Boolean(bnbPriceUsd && bnbPriceUsd > 0 && bnbRequired > 0 && availableBnb >= bnbRequired);

  return {
    userId,
    nodePriceUsd,
    bnbPriceUsd,
    bnbRequired,
    usdtRequired,
    usdtBalance: {
      available: availableUsdt,
      required: usdtRequired,
      sufficient: usdtSufficient,
      missing: usdtSufficient ? 0 : Number((usdtRequired - availableUsdt).toFixed(2)),
    },
    bnbBalance: {
      available: availableBnb,
      required: bnbRequired,
      sufficient: bnbSufficient,
      missing: bnbSufficient ? 0 : (bnbRequired > 0 ? Number((bnbRequired - availableBnb).toFixed(4)) : 0),
    },
    canActivateWithUsdt: usdtSufficient,
    canActivateWithBnb: bnbSufficient,
  };
}

/**
 * Validates internal balance and processes Genesis Node activation for a specific asset (BNB or USDT).
 * ATOMIC GUARANTEE: Ledger debit and node settlement occur inside a single DB transaction.
 * Rolls back debit completely if settlement fails. Idempotency guarantees prevent duplicate debits.
 */
export async function processNodePurchaseWithAssetBalance(
  userId: string,
  asset: 'BNB' | 'USDT' = 'USDT'
): Promise<{
  success: boolean;
  assetUsed: 'BNB' | 'USDT';
  deductedAmount: number;
  remainingAssetBalance: number;
  order: any;
  node: { publicNodeId: string; nodeNumber: number; status: string; activatedAt: string };
  isDuplicate?: boolean;
}> {
  return withUserLock(userId, async () => {
    const db = await getDb();
    const selectedAsset: 'BNB' | 'USDT' = asset.toUpperCase() === 'BNB' ? 'BNB' : 'USDT';

    // 1. Perform balance & rate validation
    const validation = await validateUserNodePurchaseBalances(userId);

    if (selectedAsset === 'BNB' && (validation.bnbPriceUsd === null || validation.bnbPriceUsd <= 0)) {
      const error: any = new Error(
        'BNB_VALUATION_NOT_CONFIGURED: BNB-based node purchase is currently blocked because BNB valuation rate is not configured in economic parameters.'
      );
      error.code = 'BNB_VALUATION_NOT_CONFIGURED';
      error.statusCode = 400;
      throw error;
    }

    let requiredAmount = 0;
    let availableBalance = 0;
    let isSufficient = false;

    if (selectedAsset === 'BNB') {
      requiredAmount = validation.bnbRequired;
      availableBalance = validation.bnbBalance.available;
      isSufficient = validation.canActivateWithBnb;
    } else {
      requiredAmount = validation.usdtRequired;
      availableBalance = validation.usdtBalance.available;
      isSufficient = validation.canActivateWithUsdt;
    }

    // 2. Reject if insufficient balance for selected asset
    if (!isSufficient) {
      const error: any = new Error(
        `Insufficient ${selectedAsset} deposit balance. You have ${availableBalance} ${selectedAsset}, but node activation requires ${requiredAmount} ${selectedAsset}.`
      );
      error.code = 'INSUFFICIENT_ASSET_BALANCE';
      error.statusCode = 400;
      error.selectedAsset = selectedAsset;
      error.availableBalance = availableBalance;
      error.requiredAmount = requiredAmount;
      error.missingAmount = Number((requiredAmount - availableBalance).toFixed(4));
      error.redirectToDeposit = true;
      throw error;
    }

    // 3. Create or acquire active reservation
    let reservation: any;
    try {
      reservation = await createNodeReservation(
        userId,
        `node_bal_req_${selectedAsset}_${userId}_${uuidv4()}`,
        `DEPOSIT_${selectedAsset}`
      );
    } catch (err: any) {
      const existingOrders = await getUserOrders(userId);
      const pending = existingOrders.find((o) => o.status === 'PENDING' && o.secondsRemaining > 0);
      if (pending) {
        reservation = { order: pending, isExisting: true };
      } else {
        throw err;
      }
    }

    // Check if order was already completed (duplicate settlement guard)
    if (reservation.order.status === 'COMPLETED') {
      const settlement = await settleNodeOrder(userId, reservation.order.publicOrderId);
      return {
        success: true,
        assetUsed: selectedAsset,
        deductedAmount: requiredAmount,
        remainingAssetBalance: availableBalance,
        order: settlement.order,
        node: settlement.node,
        isDuplicate: true,
      };
    }

    // 4. Atomic Execution: DB Transaction containing Ledger Debit + Settlement
    try {
      const result = await db.transaction(async (trx) => {
        // Lock user row to prevent concurrency race conditions
        await trx.query(`SELECT id FROM users WHERE id = $1 FOR UPDATE`, [userId]);

        // Re-verify authoritative balance inside transaction
        if (selectedAsset === 'USDT') {
          const balRes = await trx.query<{ available_balance: string | number }>(
            `
            SELECT 
              COALESCE(SUM(CASE 
                WHEN entry_type = 'CREDIT' THEN amount 
                WHEN entry_type = 'DEBIT' THEN -amount 
                WHEN entry_type = 'REVERSAL' AND source_type = 'WITHDRAWAL' THEN amount 
                WHEN entry_type = 'REVERSAL' THEN -amount 
                ELSE 0 
              END), 0) AS available_balance
            FROM financial_ledger_entries
            WHERE user_id = $1 
              AND status = 'SETTLED' 
              AND (currency = 'USDT' OR currency = 'USD') 
              AND source_type != 'NODE_REWARD'
            `,
            [userId]
          );
          const currentAvailable = Math.max(0, Number(balRes.rows[0]?.available_balance || 0));
          if (currentAvailable < requiredAmount) {
            const err: any = new Error(
              `INSUFFICIENT_ASSET_BALANCE: Available balance of ${currentAvailable} ${selectedAsset} is insufficient for required ${requiredAmount} ${selectedAsset}.`
            );
            err.code = 'INSUFFICIENT_ASSET_BALANCE';
            err.statusCode = 400;
            throw err;
          }
        }

        const orderId = reservation.order.id || reservation.order.publicOrderId;

        // Duplicate debit check inside transaction
        const existingDebitRes = await trx.query(
          `SELECT id FROM financial_ledger_entries WHERE source_id = $1 AND source_type = 'NODE_PURCHASE'`,
          [orderId]
        );

        let debitTxnId = uuidv4();
        let publicTxnId = generateLedgerTransactionPublicId();

        if (existingDebitRes.rows.length === 0) {
          await trx.query(
            `
            INSERT INTO financial_ledger_entries (
              id, public_txn_id, user_id, entry_type, source_type, source_id,
              source_ref, description, amount, currency, status, created_at
            )
            VALUES ($1, $2, $3, 'DEBIT', 'NODE_PURCHASE', $4, $5, $6, $7, $8, 'SETTLED', CURRENT_TIMESTAMP)
            `,
            [
              debitTxnId,
              publicTxnId,
              userId,
              orderId,
              reservation.order.publicNodeId,
              `Genesis Node ${reservation.order.publicNodeId} activation paid via ${selectedAsset} deposit balance`,
              requiredAmount,
              selectedAsset,
            ]
          );
        } else {
          debitTxnId = existingDebitRes.rows[0].id;
        }

        // Settle node order contract inside same transaction
        const settlement = await settleNodeOrder(
          userId,
          reservation.order.publicOrderId,
          `DEPOSIT_PAYMENT_${selectedAsset}_${publicTxnId}`,
          trx
        );

        const remainingBalance = Math.max(0, Number((availableBalance - requiredAmount).toFixed(4)));

        return {
          success: true,
          assetUsed: selectedAsset,
          deductedAmount: requiredAmount,
          remainingAssetBalance: remainingBalance,
          order: settlement.order,
          node: settlement.node,
          isDuplicate: settlement.isDuplicate,
        };
      });

      return result;
    } catch (txErr) {
      console.error('[ProcessNodePurchase TX Error]', txErr);
      throw txErr;
    }
  });
}
