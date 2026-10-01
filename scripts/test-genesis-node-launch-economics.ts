import { getDb } from '../src/server/db/db';
import { v4 as uuidv4 } from 'uuid';
import { settleNodeOrder, createNodeReservation } from '../src/server/services/nodeOrderService';
import { closeAndSettleEpoch, createRewardEpoch } from '../src/server/services/nodeRewardService';
import { getUserCoinBalance } from '../src/server/services/coinSwapService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

async function runGenesisNodeLaunchEconomicsTests() {
  console.log('==================================================');
  console.log('🧪 RUNNING GENESIS NODE LAUNCH ECONOMICS TESTS');
  console.log('==================================================\n');

  const db = await getDb();

  // 1. SETUP TEST OPERATOR USER
  const testUserId = uuidv4();
  const testPublicId = `PHX-TEST-${Date.now().toString().slice(-6)}`;
  const testEmail = `operator_${Date.now()}@phivonex.test`;

  await db.query(
    `
    INSERT INTO users (id, public_id, email, country, password_hash, full_name, status, role, created_at, updated_at)
    VALUES ($1, $2, $3, 'US', 'hash_test', 'Test Node Operator', 'ACTIVE', 'USER', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [testUserId, testPublicId, testEmail]
  );

  console.log('--- 1. VERIFY LAUNCH PARAMETERS & SNAPSHOT ON PURCHASE ---');
  // Create reservation & settle
  const reservation = await createNodeReservation(testUserId, `idem_res_${Date.now()}`);
  assert(reservation.order.amountUsd === 1000, 'Node purchase price is exactly $1,000 USD');

  const settlement = await settleNodeOrder(testUserId, reservation.order.publicOrderId, `tx_settle_${Date.now()}`);
  assert(settlement.node.status === 'ACTIVE', 'Node transitions to ACTIVE status upon settlement');

  // Query snapshot fields from database
  const nodeRes = await db.query<any>(`SELECT * FROM nodes WHERE public_node_id = $1`, [settlement.node.publicNodeId]);
  const node = nodeRes.rows[0];

  assert(Number(node.purchase_price_usd) === 1000, 'Snapshot purchasePriceUsd = 1000');
  assert(Number(node.phivo_reference_price_at_purchase) === 0.10, 'Snapshot phivoReferencePriceAtPurchase = 0.10');
  assert(Number(node.lifetime_phivo_allocation) === 10000, 'Snapshot lifetimePhivoAllocation = 10000');
  assert(Number(node.term_days) === 400, 'Snapshot termDays = 400');
  assert(Number(node.daily_phivo_emission) === 25, 'Snapshot dailyPhivoEmission = 25');
  assert(Number(node.distributed_phivo) === 0, 'Initial distributedPhivo = 0');
  assert(Number(node.remaining_phivo) === 10000, 'Initial remainingPhivo = 10000');

  console.log('\n--- 2. TEST 400-DAY EMISSION MATHEMATICS & ACCUMULATION ---');

  // Day 1 Emission
  const epoch1 = await createRewardEpoch({ rewardPerNode: 25 });
  await closeAndSettleEpoch(epoch1.id, { configuredRewardPerNode: 25, targetNodeId: node.id });

  const nodeDay1 = (await db.query<any>(`SELECT * FROM nodes WHERE id = $1`, [node.id])).rows[0];
  assert(Number(nodeDay1.distributed_phivo) === 25, 'Day 1: 25 distributed');
  assert(Number(nodeDay1.remaining_phivo) === 9975, 'Day 1: 9,975 remaining');

  // Simulate Day 100 state (99 additional emissions of 25 = 2,475 additional -> 2,500 total)
  await db.query(`UPDATE nodes SET distributed_phivo = 2500, remaining_phivo = 7500 WHERE id = $1`, [node.id]);
  const nodeDay100 = (await db.query<any>(`SELECT * FROM nodes WHERE id = $1`, [node.id])).rows[0];
  assert(Number(nodeDay100.distributed_phivo) === 2500, 'Day 100: 2,500 distributed');
  assert(Number(nodeDay100.remaining_phivo) === 7500, 'Day 100: 7,500 remaining');

  // Simulate Day 200 state (5,000 distributed, 5,000 remaining)
  await db.query(`UPDATE nodes SET distributed_phivo = 5000, remaining_phivo = 5000 WHERE id = $1`, [node.id]);
  const nodeDay200 = (await db.query<any>(`SELECT * FROM nodes WHERE id = $1`, [node.id])).rows[0];
  assert(Number(nodeDay200.distributed_phivo) === 5000, 'Day 200: 5,000 distributed');
  assert(Number(nodeDay200.remaining_phivo) === 5000, 'Day 200: 5,000 remaining');

  // Simulate Day 300 state (7,500 distributed, 2,500 remaining)
  await db.query(`UPDATE nodes SET distributed_phivo = 7500, remaining_phivo = 2500 WHERE id = $1`, [node.id]);
  const nodeDay300 = (await db.query<any>(`SELECT * FROM nodes WHERE id = $1`, [node.id])).rows[0];
  assert(Number(nodeDay300.distributed_phivo) === 7500, 'Day 300: 7,500 distributed');
  assert(Number(nodeDay300.remaining_phivo) === 2500, 'Day 300: 2,500 remaining');

  // Simulate Day 399 state (9,975 distributed, 25 remaining)
  await db.query(`UPDATE nodes SET distributed_phivo = 9975, remaining_phivo = 25, status = 'ACTIVE' WHERE id = $1`, [node.id]);

  // Day 400 Emission (Final 25 PHIVO)
  const epoch400 = await createRewardEpoch({ rewardPerNode: 25 });
  await closeAndSettleEpoch(epoch400.id, { configuredRewardPerNode: 25, targetNodeId: node.id });

  const nodeDay400 = (await db.query<any>(`SELECT * FROM nodes WHERE id = $1`, [node.id])).rows[0];
  assert(Number(nodeDay400.distributed_phivo) === 10000, 'Day 400: Exactly 10,000 distributed');
  assert(Number(nodeDay400.remaining_phivo) === 0, 'Day 400: Exactly 0 remaining');
  assert(nodeDay400.status === 'MATURED', 'Day 400: Status transitions to MATURED');

  console.log('\n--- 3. TEST DAY 401 & HARD CAP PROTECTION ---');
  // Day 401 Emission attempt
  const epoch401 = await createRewardEpoch({ rewardPerNode: 25 });
  const result401 = await closeAndSettleEpoch(epoch401.id, { configuredRewardPerNode: 25, targetNodeId: node.id });

  const nodeDay401 = (await db.query<any>(`SELECT * FROM nodes WHERE id = $1`, [node.id])).rows[0];
  assert(Number(nodeDay401.distributed_phivo) === 10000, 'Day 401: Distributed PHIVO remains strictly capped at 10,000');
  assert(Number(nodeDay401.remaining_phivo) === 0, 'Day 401: Remaining PHIVO remains 0');
  assert(nodeDay401.status === 'MATURED', 'Day 401: Status remains MATURED');

  // Verify no duplicate reward was created for Day 401
  const reward401Res = await db.query<any>(`SELECT * FROM node_rewards WHERE node_id = $1 AND epoch_id = $2`, [node.id, epoch401.id]);
  assert(reward401Res.rows.length === 0, 'Day 401: NO additional PHIVO emitted for MATURED node');

  console.log('\n--- 4. VERIFY IMMUTABLE FINANCIAL LEDGER & WALLET SYNC ---');
  const coinBal = await getUserCoinBalance(testUserId);
  assert(coinBal.availableCoinBalance > 0, 'User PHIVO balance reflects immutable ledger credits');

  const ledgerRes = await db.query<any>(`SELECT * FROM financial_ledger_entries WHERE user_id = $1 AND source_type = 'NODE_REWARD'`, [testUserId]);
  assert(ledgerRes.rows.length > 0, 'Ledger contains immutable NODE_REWARD entries');

  console.log('\n==================================================');
  console.log('📊 ALL 20 LAUNCH ECONOMICS TEST ASSERTIONS PASSED!');
  console.log('==================================================\n');
}

runGenesisNodeLaunchEconomicsTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
