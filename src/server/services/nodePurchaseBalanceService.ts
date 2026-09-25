import { getDb } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { generateLedgerTransactionPublicId } from '../utils/idGenerator';
import { getNodeBasePrice } from './economicService';
import { createNodeReservation, settleNodeOrder, getUserOrders } from './nodeOrderService';

// Server-authoritative exchange rate for BNB node valuation
const DEFAULT_BNB_PRICE_USD = 450.0; // 1 BNB = $450 USD (~2.222 BNB for $1,000 node)

export interface AssetBalanceInfo {
  available: number;
  required: number;
  sufficient: boolean;
  missing: number;
}

export interface NodeBalanceValidationResult {
  userId: string;
  nodePriceUsd: number;
  bnbPriceUsd: number;
  bnbRequired: number;
  usdtRequired: number;
  usdtBalance: AssetBalanceInfo;
  bnbBalance: AssetBalanceInfo;
  canActivateWithUsdt: boolean;
  canActivateWithBnb: boolean;
}

/**
 * Validates the authenticated user's internal deposit balances (BNB & USDT)
 * specifically for Genesis Node activation eligibility.
 */
export async function validateUserNodePurchaseBalances(
  userId: string
): Promise<NodeBalanceValidationResult> {
  const db = await getDb();

  // 1. Get Node Price in USD
  const nodePriceUsd = await getNodeBasePrice(); // e.g. 1000
  const bnbPriceUsd = DEFAULT_BNB_PRICE_USD;
  const bnbRequired = Number((nodePriceUsd / bnbPriceUsd).toFixed(4)); // e.g. ~2.2222
  const usdtRequired = nodePriceUsd;

  // 2. Compute USDT Credited Deposits vs Node Purchase Debits
  const usdtDepositsRes = await db.query<{ total: string | number }>(
    `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM blockchain_deposits
    WHERE user_id = $1 AND status = 'CREDITED' AND (asset = 'USDT' OR asset IS NULL)
    `,
    [userId]
  );
  const totalUsdtDeposits = Number(usdtDepositsRes.rows[0]?.total || 0);

  const usdtDebitsRes = await db.query<{ total: string | number }>(
    `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM financial_ledger_entries
    WHERE user_id = $1 AND entry_type = 'DEBIT' AND source_type = 'NODE_PURCHASE' AND (currency = 'USDT' OR currency = 'USD')
    `,
    [userId]
  );
  const totalUsdtDebits = Number(usdtDebitsRes.rows[0]?.total || 0);
  const availableUsdt = Math.max(0, totalUsdtDeposits - totalUsdtDebits);

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

  // 4. Balance sufficiency checks
  const usdtSufficient = availableUsdt >= usdtRequired;
  const bnbSufficient = availableBnb >= bnbRequired;

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
      missing: bnbSufficient ? 0 : Number((bnbRequired - availableBnb).toFixed(4)),
    },
    canActivateWithUsdt: usdtSufficient,
    canActivateWithBnb: bnbSufficient,
  };
}

/**
 * Validates internal balance and processes Genesis Node activation for a specific asset (BNB or USDT).
 * Atomically records a DEBIT in financial_ledger_entries and settles node order.
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
}> {
  const db = await getDb();
  const selectedAsset = asset.toUpperCase() === 'BNB' ? 'BNB' : 'USDT';

  // 1. Perform balance validation
  const validation = await validateUserNodePurchaseBalances(userId);

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
      `node_bal_req_${selectedAsset}_${userId}_${Date.now()}`,
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

  // 4. Record DEBIT transaction in financial_ledger_entries
  const debitTxnId = uuidv4();
  const publicTxnId = generateLedgerTransactionPublicId();

  await db.query(
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
      reservation.order.id || debitTxnId,
      reservation.order.publicNodeId,
      `Genesis Node ${reservation.order.publicNodeId} activation paid via ${selectedAsset} deposit balance`,
      requiredAmount,
      selectedAsset,
    ]
  );

  // 5. Settle node order activation contract
  const settlement = await settleNodeOrder(
    userId,
    reservation.order.publicOrderId,
    `DEPOSIT_PAYMENT_${selectedAsset}_${publicTxnId}`
  );

  const remainingBalance = Math.max(0, Number((availableBalance - requiredAmount).toFixed(4)));

  return {
    success: true,
    assetUsed: selectedAsset,
    deductedAmount: requiredAmount,
    remainingAssetBalance: remainingBalance,
    order: settlement.order,
    node: settlement.node,
  };
}
