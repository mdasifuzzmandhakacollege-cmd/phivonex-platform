import { getDb } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { generateLedgerTransactionPublicId } from '../utils/idGenerator';

export type LedgerEntryType = 'CREDIT' | 'DEBIT' | 'REVERSAL';
export type LedgerSourceType = 'REFERRAL_COMMISSION' | 'MATCHING_BONUS' | 'PROMOTION_BONUS' | 'NODE_REWARD' | 'WITHDRAWAL';

export interface LedgerTransaction {
  id: string;
  publicTxnId: string;
  userId: string;
  entryType: LedgerEntryType;
  sourceType: LedgerSourceType;
  sourceId: string;
  sourceRef: string;
  description: string;
  amount: number;
  currency: string;
  status: 'SETTLED' | 'REVERSED' | 'PENDING';
  createdAt: string;
}

export interface WalletSummaryResponse {
  totalEarned: number;
  totalReversed: number;
  totalWithdrawn: number;
  ledgerBalance: number;
  availableBalance: number;
  transactionCount: number;
  breakdown: {
    referral: number;
    matching: number;
    promotion: number;
    nodeReward: number;
  };
  grossBreakdown: {
    referral: number;
    matching: number;
    promotion: number;
    nodeReward: number;
  };
}

export interface WalletTransactionsResponse {
  transactions: LedgerTransaction[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

/**
 * Post a CREDIT entry to the financial ledger with strict idempotency.
 * Guarded by UNIQUE(source_type, source_id, entry_type).
 */
export async function postLedgerCredit(params: {
  userId: string;
  sourceType: LedgerSourceType;
  sourceId: string;
  sourceRef: string;
  amount: number;
  description: string;
  createdAt?: Date;
}): Promise<LedgerTransaction | null> {
  const { userId, sourceType, sourceId, sourceRef, amount, description, createdAt } = params;
  if (!amount || amount <= 0) return null;

  const db = await getDb();
  const id = uuidv4();
  const publicTxnId = generateLedgerTransactionPublicId();
  const effectiveTime = createdAt || new Date();

  // Strict idempotency: ON CONFLICT DO NOTHING
  const res = await db.query<{
    id: string;
    public_txn_id: string;
    user_id: string;
    entry_type: LedgerEntryType;
    source_type: LedgerSourceType;
    source_id: string;
    source_ref: string;
    description: string;
    amount: string | number;
    currency: string;
    status: 'SETTLED' | 'REVERSED' | 'PENDING';
    created_at: Date;
  }>(
    `
    INSERT INTO financial_ledger_entries (
      id, public_txn_id, user_id, entry_type, source_type, source_id,
      source_ref, description, amount, currency, status, created_at
    )
    VALUES ($1, $2, $3, 'CREDIT', $4, $5, $6, $7, $8, 'USD', 'SETTLED', $9)
    ON CONFLICT (source_type, source_id, entry_type) DO NOTHING
    RETURNING *
    `,
    [id, publicTxnId, userId, sourceType, sourceId, sourceRef, description, amount, effectiveTime]
  );

  if (res.rows.length > 0) {
    const row = res.rows[0];
    return {
      id: row.id,
      publicTxnId: row.public_txn_id,
      userId: row.user_id,
      entryType: row.entry_type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceRef: row.source_ref,
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  // Already posted: fetch existing
  const existing = await db.query<{
    id: string;
    public_txn_id: string;
    user_id: string;
    entry_type: LedgerEntryType;
    source_type: LedgerSourceType;
    source_id: string;
    source_ref: string;
    description: string;
    amount: string | number;
    currency: string;
    status: 'SETTLED' | 'REVERSED' | 'PENDING';
    created_at: Date;
  }>(
    `
    SELECT * FROM financial_ledger_entries
    WHERE source_type = $1 AND source_id = $2 AND entry_type = 'CREDIT'
    `,
    [sourceType, sourceId]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      id: row.id,
      publicTxnId: row.public_txn_id,
      userId: row.user_id,
      entryType: row.entry_type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceRef: row.source_ref,
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  return null;
}

/**
 * Post a REVERSAL entry to the financial ledger with strict idempotency.
 * Guarded by UNIQUE(source_type, source_id, entry_type).
 */
export async function postLedgerReversal(params: {
  userId: string;
  sourceType: LedgerSourceType;
  sourceId: string;
  sourceRef: string;
  amount: number;
  description: string;
  createdAt?: Date;
}): Promise<LedgerTransaction | null> {
  const { userId, sourceType, sourceId, sourceRef, amount, description, createdAt } = params;
  if (!amount || amount <= 0) return null;

  const db = await getDb();
  const id = uuidv4();
  const publicTxnId = generateLedgerTransactionPublicId();
  const effectiveTime = createdAt || new Date();

  // Strict idempotency: ON CONFLICT DO NOTHING
  const res = await db.query<{
    id: string;
    public_txn_id: string;
    user_id: string;
    entry_type: LedgerEntryType;
    source_type: LedgerSourceType;
    source_id: string;
    source_ref: string;
    description: string;
    amount: string | number;
    currency: string;
    status: 'SETTLED' | 'REVERSED' | 'PENDING';
    created_at: Date;
  }>(
    `
    INSERT INTO financial_ledger_entries (
      id, public_txn_id, user_id, entry_type, source_type, source_id,
      source_ref, description, amount, currency, status, created_at
    )
    VALUES ($1, $2, $3, 'REVERSAL', $4, $5, $6, $7, $8, 'USD', 'SETTLED', $9)
    ON CONFLICT (source_type, source_id, entry_type) DO NOTHING
    RETURNING *
    `,
    [id, publicTxnId, userId, sourceType, sourceId, sourceRef, description, amount, effectiveTime]
  );

  if (res.rows.length > 0) {
    const row = res.rows[0];
    return {
      id: row.id,
      publicTxnId: row.public_txn_id,
      userId: row.user_id,
      entryType: row.entry_type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceRef: row.source_ref,
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  // Already posted: fetch existing
  const existing = await db.query<{
    id: string;
    public_txn_id: string;
    user_id: string;
    entry_type: LedgerEntryType;
    source_type: LedgerSourceType;
    source_id: string;
    source_ref: string;
    description: string;
    amount: string | number;
    currency: string;
    status: 'SETTLED' | 'REVERSED' | 'PENDING';
    created_at: Date;
  }>(
    `
    SELECT * FROM financial_ledger_entries
    WHERE source_type = $1 AND source_id = $2 AND entry_type = 'REVERSAL'
    `,
    [sourceType, sourceId]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      id: row.id,
      publicTxnId: row.public_txn_id,
      userId: row.user_id,
      entryType: row.entry_type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceRef: row.source_ref,
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  return null;
}

/**
 * Post a DEBIT entry to the financial ledger with strict idempotency.
 * Guarded by UNIQUE(source_type, source_id, entry_type).
 */
export async function postLedgerDebit(params: {
  userId: string;
  sourceType: LedgerSourceType;
  sourceId: string;
  sourceRef: string;
  amount: number;
  description: string;
  createdAt?: Date;
}): Promise<LedgerTransaction | null> {
  const { userId, sourceType, sourceId, sourceRef, amount, description, createdAt } = params;
  if (!amount || amount <= 0) return null;

  const db = await getDb();
  const id = uuidv4();
  const publicTxnId = generateLedgerTransactionPublicId();
  const effectiveTime = createdAt || new Date();

  // Strict idempotency: ON CONFLICT DO NOTHING
  const res = await db.query<{
    id: string;
    public_txn_id: string;
    user_id: string;
    entry_type: LedgerEntryType;
    source_type: LedgerSourceType;
    source_id: string;
    source_ref: string;
    description: string;
    amount: string | number;
    currency: string;
    status: 'SETTLED' | 'REVERSED' | 'PENDING';
    created_at: Date;
  }>(
    `
    INSERT INTO financial_ledger_entries (
      id, public_txn_id, user_id, entry_type, source_type, source_id,
      source_ref, description, amount, currency, status, created_at
    )
    VALUES ($1, $2, $3, 'DEBIT', $4, $5, $6, $7, $8, 'USD', 'SETTLED', $9)
    ON CONFLICT (source_type, source_id, entry_type) DO NOTHING
    RETURNING *
    `,
    [id, publicTxnId, userId, sourceType, sourceId, sourceRef, description, amount, effectiveTime]
  );

  if (res.rows.length > 0) {
    const row = res.rows[0];
    return {
      id: row.id,
      publicTxnId: row.public_txn_id,
      userId: row.user_id,
      entryType: row.entry_type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceRef: row.source_ref,
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  // Already posted: fetch existing
  const existing = await db.query<{
    id: string;
    public_txn_id: string;
    user_id: string;
    entry_type: LedgerEntryType;
    source_type: LedgerSourceType;
    source_id: string;
    source_ref: string;
    description: string;
    amount: string | number;
    currency: string;
    status: 'SETTLED' | 'REVERSED' | 'PENDING';
    created_at: Date;
  }>(
    `
    SELECT * FROM financial_ledger_entries
    WHERE source_type = $1 AND source_id = $2 AND entry_type = 'DEBIT'
    `,
    [sourceType, sourceId]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      id: row.id,
      publicTxnId: row.public_txn_id,
      userId: row.user_id,
      entryType: row.entry_type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      sourceRef: row.source_ref,
      description: row.description,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  return null;
}

/**
 * Idempotently reconciles and synchronizes any unposted earnings/reversals
 * for a specific user into the authoritative financial ledger.
 */
export async function syncUserLedger(userId: string): Promise<void> {
  const db = await getDb();

  // 1. Reconcile Referral Commissions
  const commRes = await db.query<{
    id: string;
    public_commission_id: string;
    amount_usd: string | number;
    status: string;
    earned_at: Date;
    reversed_at: Date | null;
  }>(
    `
    SELECT id, public_commission_id, amount_usd, status, earned_at, reversed_at
    FROM referral_commissions
    WHERE sponsor_user_id = $1
    `,
    [userId]
  );

  for (const c of commRes.rows) {
    // Post CREDIT
    await postLedgerCredit({
      userId,
      sourceType: 'REFERRAL_COMMISSION',
      sourceId: c.id,
      sourceRef: c.public_commission_id,
      amount: Number(c.amount_usd),
      description: 'Direct Referral Commission - Node Activation',
      createdAt: new Date(c.earned_at),
    });

    // If reversed, post REVERSAL
    if (c.status === 'REVERSED') {
      await postLedgerReversal({
        userId,
        sourceType: 'REFERRAL_COMMISSION',
        sourceId: c.id,
        sourceRef: c.public_commission_id,
        amount: Number(c.amount_usd),
        description: 'Direct Referral Commission Reversal',
        createdAt: c.reversed_at ? new Date(c.reversed_at) : new Date(),
      });
    }
  }

  // 2. Reconcile Matching Settlements
  const matchRes = await db.query<{
    id: string;
    public_settlement_id: string;
    business_date: string | Date;
    total_bonus_usd: string | number;
    status: string;
    settled_at: Date;
  }>(
    `
    SELECT id, public_settlement_id, business_date, total_bonus_usd, status, settled_at
    FROM binary_matching_settlements
    WHERE user_id = $1 AND total_bonus_usd > 0
    `,
    [userId]
  );

  for (const m of matchRes.rows) {
    const bDate = typeof m.business_date === 'string' ? m.business_date.split('T')[0] : new Date(m.business_date).toISOString().split('T')[0];

    // Post CREDIT
    await postLedgerCredit({
      userId,
      sourceType: 'MATCHING_BONUS',
      sourceId: m.id,
      sourceRef: m.public_settlement_id,
      amount: Number(m.total_bonus_usd),
      description: `Daily Binary Matching Settlement (${bDate})`,
      createdAt: new Date(m.settled_at),
    });

    // If reversed, post REVERSAL
    if (m.status === 'REVERSED') {
      await postLedgerReversal({
        userId,
        sourceType: 'MATCHING_BONUS',
        sourceId: m.id,
        sourceRef: m.public_settlement_id,
        amount: Number(m.total_bonus_usd),
        description: `Daily Binary Matching Settlement Reversal (${bDate})`,
        createdAt: new Date(),
      });
    }
  }

  // 3. Reconcile Promotion Bonuses
  const promoRes = await db.query<{
    id: string;
    public_bonus_id: string;
    milestone: string;
    amount_usd: string | number;
    status: string;
    qualified_at: Date;
  }>(
    `
    SELECT id, public_bonus_id, milestone, amount_usd, status, qualified_at
    FROM promotion_bonuses
    WHERE user_id = $1
    `,
    [userId]
  );

  for (const p of promoRes.rows) {
    // Post CREDIT
    await postLedgerCredit({
      userId,
      sourceType: 'PROMOTION_BONUS',
      sourceId: p.id,
      sourceRef: p.public_bonus_id,
      amount: Number(p.amount_usd),
      description: `Promotion Milestone Bonus - ${p.milestone}`,
      createdAt: new Date(p.qualified_at),
    });

    // If reversed, post REVERSAL
    if (p.status === 'REVERSED') {
      await postLedgerReversal({
        userId,
        sourceType: 'PROMOTION_BONUS',
        sourceId: p.id,
        sourceRef: p.public_bonus_id,
        amount: Number(p.amount_usd),
        description: `Promotion Milestone Bonus Reversal - ${p.milestone}`,
        createdAt: new Date(),
      });
    }
  }

  // 4. Reconcile Node Mining Rewards
  const rewardRes = await db.query<{
    id: string;
    public_reward_id: string;
    amount: string | number;
    status: string;
    accrued_at: Date;
    reversed_at: Date | null;
  }>(
    `
    SELECT id, public_reward_id, amount, status, accrued_at, reversed_at
    FROM node_rewards
    WHERE owner_user_id = $1
    `,
    [userId]
  );

  for (const r of rewardRes.rows) {
    // Post CREDIT
    await postLedgerCredit({
      userId,
      sourceType: 'NODE_REWARD',
      sourceId: r.id,
      sourceRef: r.public_reward_id,
      amount: Number(r.amount),
      description: 'Genesis Node Mining Reward Accrual',
      createdAt: new Date(r.accrued_at),
    });

    // If reversed, post REVERSAL
    if (r.status === 'REVERSED') {
      await postLedgerReversal({
        userId,
        sourceType: 'NODE_REWARD',
        sourceId: r.id,
        sourceRef: r.public_reward_id,
        amount: Number(r.amount),
        description: 'Genesis Node Mining Reward Reversal',
        createdAt: r.reversed_at ? new Date(r.reversed_at) : new Date(),
      });
    }
  }
}

/**
 * Returns the user's wallet summary:
 * - totalEarned
 * - totalReversed
 * - ledgerBalance
 * - transactionCount
 * - breakdown by source type (referral, matching, promotion, nodeReward)
 */
export async function getWalletSummary(userId: string): Promise<WalletSummaryResponse> {
  // Sync unposted earnings first
  await syncUserLedger(userId);

  const db = await getDb();

  // Aggregate by entry_type and source_type
  const aggRes = await db.query<{
    entry_type: LedgerEntryType;
    source_type: LedgerSourceType;
    total_amount: string | number;
    count: string | number;
  }>(
    `
    SELECT 
      entry_type,
      source_type,
      COALESCE(SUM(amount), 0) AS total_amount,
      COUNT(*) AS count
    FROM financial_ledger_entries
    WHERE user_id = $1 AND status = 'SETTLED'
    GROUP BY entry_type, source_type
    `,
    [userId]
  );

  let totalEarned = 0;
  let earningReversals = 0;
  let totalDebited = 0;
  let withdrawalReversals = 0;
  let transactionCount = 0;

  const grossCredits = {
    referral: 0,
    matching: 0,
    promotion: 0,
    nodeReward: 0,
  };

  const reversals = {
    referral: 0,
    matching: 0,
    promotion: 0,
    nodeReward: 0,
  };

  for (const row of aggRes.rows) {
    const amt = Number(row.total_amount);
    const cnt = Number(row.count);
    transactionCount += cnt;

    if (row.entry_type === 'CREDIT') {
      totalEarned += amt;
      if (row.source_type === 'REFERRAL_COMMISSION') grossCredits.referral += amt;
      else if (row.source_type === 'MATCHING_BONUS') grossCredits.matching += amt;
      else if (row.source_type === 'PROMOTION_BONUS') grossCredits.promotion += amt;
      else if (row.source_type === 'NODE_REWARD') grossCredits.nodeReward += amt;
    } else if (row.entry_type === 'REVERSAL') {
      if (row.source_type === 'WITHDRAWAL') {
        withdrawalReversals += amt;
      } else {
        earningReversals += amt;
        if (row.source_type === 'REFERRAL_COMMISSION') reversals.referral += amt;
        else if (row.source_type === 'MATCHING_BONUS') reversals.matching += amt;
        else if (row.source_type === 'PROMOTION_BONUS') reversals.promotion += amt;
        else if (row.source_type === 'NODE_REWARD') reversals.nodeReward += amt;
      }
    } else if (row.entry_type === 'DEBIT') {
      totalDebited += amt;
    }
  }

  // Net breakdown per earning channel
  const breakdown = {
    referral: Math.max(0, grossCredits.referral - reversals.referral),
    matching: Math.max(0, grossCredits.matching - reversals.matching),
    promotion: Math.max(0, grossCredits.promotion - reversals.promotion),
    nodeReward: Math.max(0, grossCredits.nodeReward - reversals.nodeReward),
  };

  const netEarned = Math.max(0, totalEarned - earningReversals);
  const netWithdrawn = Math.max(0, totalDebited - withdrawalReversals);
  const ledgerBalance = Math.max(0, netEarned - netWithdrawn);

  return {
    totalEarned: netEarned,
    totalReversed: earningReversals,
    totalWithdrawn: netWithdrawn,
    ledgerBalance,
    availableBalance: ledgerBalance,
    transactionCount,
    breakdown,
    grossBreakdown: grossCredits,
  };
}

/**
 * Returns the user's ledger transactions with safe pagination and optional type filtering.
 */
export async function getWalletTransactions(
  userId: string,
  page = 1,
  limit = 20,
  typeFilter?: string,
  searchQuery?: string
): Promise<WalletTransactionsResponse> {
  await syncUserLedger(userId);

  const db = await getDb();
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const offset = (safePage - 1) * safeLimit;

  // Determine normalized source types to filter
  let types: string[] | null = null;
  if (typeFilter && typeFilter !== 'all' && typeFilter !== 'ALL') {
    const u = typeFilter.toUpperCase();
    if (u === 'NODE_ACTIVATION' || u === 'NODE_REWARD' || u === 'NODE_MINING') {
      types = ['NODE_REWARD'];
    } else if (u === 'REFERRAL_COMMISSION' || u === 'REFERRAL') {
      types = ['REFERRAL_COMMISSION'];
    } else if (u === 'MATCHING_BONUS' || u === 'MATCHING') {
      types = ['MATCHING_BONUS'];
    } else if (u === 'PROMOTION_BONUS' || u === 'PROMOTION') {
      types = ['PROMOTION_BONUS'];
    } else {
      types = [u];
    }
  }

  const cleanSearch = searchQuery ? searchQuery.trim() : '';

  let whereClauses = ['user_id = $1'];
  let queryParams: any[] = [userId];
  let paramIdx = 2;

  if (types && types.length > 0) {
    whereClauses.push(`source_type = ANY($${paramIdx}::text[])`);
    queryParams.push(types);
    paramIdx++;
  }

  if (cleanSearch) {
    whereClauses.push(`(public_txn_id ILIKE $${paramIdx} OR description ILIKE $${paramIdx} OR source_ref ILIKE $${paramIdx} OR id ILIKE $${paramIdx})`);
    queryParams.push(`%${cleanSearch}%`);
    paramIdx++;
  }

  const whereSql = whereClauses.join(' AND ');

  const countRes = await db.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count FROM financial_ledger_entries WHERE ${whereSql}`,
    queryParams
  );
  const totalCount = Number(countRes.rows[0]?.count || 0);

  const limitParamIdx = paramIdx;
  const offsetParamIdx = paramIdx + 1;
  const txQueryParams = [...queryParams, safeLimit, offset];

  const txRes = await db.query<any>(
    `
    SELECT *
    FROM financial_ledger_entries
    WHERE ${whereSql}
    ORDER BY created_at DESC
    LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `,
    txQueryParams
  );
  const txRows = txRes.rows;

  const totalPages = Math.ceil(totalCount / safeLimit) || 1;

  const transactions: LedgerTransaction[] = txRows.map((row) => ({
    id: row.id,
    publicTxnId: row.public_txn_id,
    userId: row.user_id,
    entryType: row.entry_type,
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceRef: row.source_ref,
    description: row.description,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  return {
    transactions,
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages,
    },
  };
}
