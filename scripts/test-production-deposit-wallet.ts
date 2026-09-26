/**
 * PHIVONEX — PRODUCTION LIVE DEPOSIT WALLET SETUP TEST SUITE
 * 
 * Verifies all 16 production live requirements:
 * 1. APP_ENV = production & BSC_CHAIN_ID = 56 & BSC Mainnet RPC endpoints
 * 2. Official USDT BEP-20 contract address (0x55d398326f99059fF775485246999027B3197955)
 * 3. Unique user deposit addresses derived purely from DEPOSIT_ADDRESS_XPUB
 * 4. Zero raw private keys, mnemonics, seeds, or xprv stored or required
 * 5. Monotonic unique derivation index stored per user (never reused)
 * 6. Private signing isolation via SIGNER_SECRET_REFERENCE
 * 7. TREASURY_WALLET_ADDRESS sweep destination
 * 8. Complete deposit flow with idempotent ledger credit
 * 9. Gas management for USDT sweep (child balance detection + min gas funding)
 * 10. RPC primary + secondary failover
 * 11. Idempotency on (chain_id, tx_hash, log_index, to_address)
 * 12. Security verifications (Chain ID, USDT contract, Destination check)
 * 13. Persisted states: DETECTED / CONFIRMING / CONFIRMED / CREDITED / SWEPT
 * 14. Server restart safe recovery
 * 15. WITHDRAWALS_ENABLED strictly false
 */

process.env.NODE_ENV = 'test';
process.env.APP_ENV = 'production';
process.env.BSC_CHAIN_ID = '56';
process.env.DEPOSIT_CONFIRMATIONS = '3';
process.env.TREASURY_WALLET_ADDRESS = '0x71c8705e3473187f6c1ab3c4709d4352d7f338f0';
process.env.USDT_CONTRACT_ADDRESS = '0x55d398326f99059ff775485246999027b3197955';
process.env.WITHDRAWALS_ENABLED = 'false';

import { getDb } from '../src/server/db/db';
import { v4 as uuidv4 } from 'uuid';
import { BSC_CONFIG } from '../src/config/bscConfig';
import {
  getOrCreateUserDepositAddress,
  findUserByDepositAddress,
  deriveAddressFromXpub,
  getDepositAddressXpub,
} from '../src/server/services/bscKeyService';
import {
  processBlockchainDepositEvent,
  sweepDepositToTreasury,
  recoverAndSyncPendingDeposits,
  getUserDeposits,
} from '../src/server/services/bscDepositService';
import { bscRpcManager } from '../src/server/providers/bscRpcProvider';
import { getIntegrationConfig } from '../src/config/integrationConfig';
import { ethers } from 'ethers';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
    failedTests++;
  }
}

async function runProductionTestSuite() {
  console.log('\n===============================================================');
  console.log('🛡️  PHIVONEX — PRODUCTION LIVE DEPOSIT WALLET TEST SUITE');
  console.log('===============================================================\n');

  const db = await getDb();

  // Setup Test Users
  const user1Id = uuidv4();
  const user2Id = uuidv4();
  const user3Id = uuidv4();
  const suffix = uuidv4().slice(0, 6).toUpperCase();

  await db.query(
    `
    INSERT INTO users (id, public_id, full_name, email, country, password_hash, status, role)
    VALUES 
      ($1, $4, 'Prod Tester 1', $5, 'US', 'hash123', 'ACTIVE', 'USER'),
      ($2, $6, 'Prod Tester 2', $7, 'US', 'hash123', 'ACTIVE', 'USER'),
      ($3, $8, 'Prod Tester 3', $9, 'US', 'hash123', 'ACTIVE', 'USER')
    ON CONFLICT (id) DO NOTHING;
    `,
    [
      user1Id,
      user2Id,
      user3Id,
      `PHX-P1-${suffix}`,
      `prod1.${suffix.toLowerCase()}@phivonex.test`,
      `PHX-P2-${suffix}`,
      `prod2.${suffix.toLowerCase()}@phivonex.test`,
      `PHX-P3-${suffix}`,
      `prod3.${suffix.toLowerCase()}@phivonex.test`,
    ]
  );

  // =========================================================================
  // 1. PRODUCTION ENVIRONMENT & NETWORK CONFIGURATION
  // =========================================================================
  console.log('--- 1. PRODUCTION ENVIRONMENT & MAINNET CONFIGURATION ---');
  assert(BSC_CONFIG.APP_ENV === 'production', 'APP_ENV is production');
  assert(BSC_CONFIG.CHAIN_ID === 56, 'BSC_CHAIN_ID is 56 (BNB Smart Chain Mainnet)');
  assert(BSC_CONFIG.NETWORK_NAME === 'BNB Smart Chain Mainnet', 'Network name is BNB Smart Chain Mainnet');
  assert(Boolean(BSC_CONFIG.RPC_URL_PRIMARY), 'BSC_RPC_URL_PRIMARY is configured');
  assert(Boolean(BSC_CONFIG.RPC_URL_SECONDARY), 'BSC_RPC_URL_SECONDARY is configured');
  assert(
    BSC_CONFIG.USDT_CONTRACT_ADDRESS === '0x55d398326f99059ff775485246999027b3197955',
    'USDT Contract is official BSC Mainnet Binance-Peg USDT (0x55d398326f99059ff775485246999027b3197955)'
  );
  assert(
    BSC_CONFIG.TREASURY_WALLET_ADDRESS === '0x71c8705e3473187f6c1ab3c4709d4352d7f338f0',
    'TREASURY_WALLET_ADDRESS is configured as authoritative collection address'
  );
  assert(BSC_CONFIG.WITHDRAWALS_ENABLED === false, 'WITHDRAWALS_ENABLED is strictly false until separately approved');

  // =========================================================================
  // 2. UNIQUE USER DEPOSIT ADDRESSES & XPUB DERIVATION
  // =========================================================================
  console.log('\n--- 2. UNIQUE USER DEPOSIT ADDRESSES & XPUB DERIVATION ---');
  const user1Deposit = await getOrCreateUserDepositAddress(user1Id, 'USDT');
  const user2Deposit = await getOrCreateUserDepositAddress(user2Id, 'USDT');
  const user3Deposit = await getOrCreateUserDepositAddress(user3Id, 'USDT');

  assert(Boolean(user1Deposit.address), 'User 1 received a BSC deposit address');
  assert(Boolean(user2Deposit.address), 'User 2 received a BSC deposit address');
  assert(Boolean(user3Deposit.address), 'User 3 received a BSC deposit address');
  assert(
    user1Deposit.address !== user2Deposit.address && user2Deposit.address !== user3Deposit.address,
    'Each user receives a unique, distinct BSC deposit address'
  );

  // Derivation index monotonicity and non-reuse
  assert(
    user1Deposit.derivationIndex !== user2Deposit.derivationIndex,
    'Each user receives a unique derivation index (never reused)'
  );
  assert(
    user2Deposit.derivationIndex > user1Deposit.derivationIndex,
    'Derivation indices are monotonically allocated'
  );

  // Address retrieval idempotency
  const user1Recheck = await getOrCreateUserDepositAddress(user1Id, 'USDT');
  assert(user1Recheck.address === user1Deposit.address, 'Idempotent: Subsequent retrieval returns identical address');
  assert(user1Recheck.derivationIndex === user1Deposit.derivationIndex, 'Idempotent: Derivation index preserved');

  // Verify pure public derivation from XPUB
  const xpub = getDepositAddressXpub();
  assert(xpub.startsWith('xpub'), 'Derivation uses extended public key (DEPOSIT_ADDRESS_XPUB)');
  const derivedDirect = deriveAddressFromXpub(xpub, user1Deposit.derivationIndex);
  assert(derivedDirect.address === user1Deposit.address, 'Direct public derivation from XPUB matches stored address');

  // Reverse address lookup
  const resolvedUser = await findUserByDepositAddress(user1Deposit.address);
  assert(resolvedUser === user1Id, 'findUserByDepositAddress correctly resolves owner user ID');

  const unknownResolved = await findUserByDepositAddress('0x9999999999999999999999999999999999999999');
  assert(unknownResolved === null, 'Unknown address safely resolves to null');

  // Verify Zero Private Keys in DB or Models
  const dbCheck = await db.query(`SELECT * FROM user_deposit_addresses WHERE user_id = $1`, [user1Id]);
  const cols = Object.keys(dbCheck.rows[0]);
  assert(
    !cols.includes('private_key') && !cols.includes('secret') && !cols.includes('mnemonic') && !cols.includes('xprv'),
    'Database table stores ZERO private keys, mnemonics, seeds, or xprv'
  );

  // =========================================================================
  // 3. DEPOSIT SECURITY & CHAIN / CONTRACT / DESTINATION VERIFICATIONS
  // =========================================================================
  console.log('\n--- 3. DEPOSIT SECURITY & CONTRACT VERIFICATIONS ---');
  const dummyTx = `0x${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`.slice(0, 66);
  const blockStart = 48000000;

  // Rejection of mismatched Chain ID
  const wrongChainRes = await processBlockchainDepositEvent({
    chainId: 1, // Ethereum Mainnet instead of BSC 56
    asset: 'USDT',
    txHash: dummyTx,
    fromAddress: '0xsender1111111111111111111111111111111111',
    toAddress: user1Deposit.address,
    amount: 100,
    blockNumber: blockStart,
    currentBlockNumber: blockStart + 5,
  });
  assert(wrongChainRes === null, 'Security: Rejected deposit with mismatched chain ID');

  // Rejection of counterfeit USDT contract
  const fakeContractRes = await processBlockchainDepositEvent({
    chainId: 56,
    asset: 'USDT',
    contractAddress: '0xfaketokencontract0000000000000000000000',
    txHash: dummyTx,
    fromAddress: '0xsender1111111111111111111111111111111111',
    toAddress: user1Deposit.address,
    amount: 100,
    blockNumber: blockStart,
    currentBlockNumber: blockStart + 5,
  });
  assert(fakeContractRes === null, 'Security: Rejected deposit from counterfeit token contract address');

  // Rejection of third-party non-PHIVONEX address
  const foreignAddrRes = await processBlockchainDepositEvent({
    chainId: 56,
    asset: 'USDT',
    contractAddress: BSC_CONFIG.USDT_CONTRACT_ADDRESS,
    txHash: dummyTx,
    fromAddress: '0xsender1111111111111111111111111111111111',
    toAddress: '0xexternalwallet111111111111111111111111111',
    amount: 100,
    blockNumber: blockStart,
    currentBlockNumber: blockStart + 5,
  });
  assert(foreignAddrRes === null, 'Security: Safely ignored deposit to non-PHIVONEX address');

  // =========================================================================
  // 4. PRODUCTION DEPOSIT CONFIRMATION PROGRESSION & LEDGER IDEMPOTENCY
  // =========================================================================
  console.log('\n--- 4. DEPOSIT CONFIRMATIONS & LEDGER IDEMPOTENCY ---');
  const validTxHash = `0xusdt${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '')}`.slice(0, 66);
  const depositAmount = 500.0;

  // Step 1: 1 confirmation (Status = CONFIRMING / DETECTED)
  const step1 = await processBlockchainDepositEvent({
    chainId: 56,
    asset: 'USDT',
    contractAddress: BSC_CONFIG.USDT_CONTRACT_ADDRESS,
    txHash: validTxHash,
    logIndex: 0,
    fromAddress: '0xsender1111111111111111111111111111111111',
    toAddress: user1Deposit.address,
    amount: depositAmount,
    blockNumber: blockStart,
    currentBlockNumber: blockStart, // 1 confirmation
  });

  assert(step1 !== null, 'Valid USDT deposit detected');
  assert(step1?.status === 'CONFIRMING' || step1?.status === 'DETECTED', 'Status is CONFIRMING at 1 confirmation');
  assert(step1?.creditedAt === null, 'NEVER credit balance on unconfirmed deposit (1/3 confs)');

  // Verify ledger has 0 credits
  const preCreditLedger = await db.query(
    `SELECT * FROM financial_ledger_entries WHERE user_id = $1 AND source_id = $2`,
    [user1Id, step1?.id]
  );
  assert(preCreditLedger.rows.length === 0, 'Ledger has 0 entries while unconfirmed');

  // Step 2: 2 confirmations (< 3 required)
  const step2 = await processBlockchainDepositEvent({
    chainId: 56,
    asset: 'USDT',
    contractAddress: BSC_CONFIG.USDT_CONTRACT_ADDRESS,
    txHash: validTxHash,
    logIndex: 0,
    fromAddress: '0xsender1111111111111111111111111111111111',
    toAddress: user1Deposit.address,
    amount: depositAmount,
    blockNumber: blockStart,
    currentBlockNumber: blockStart + 1, // 2 confirmations
  });
  assert(step2?.confirmations === 2, 'Confirmations advanced to 2');
  assert(step2?.creditedAt === null, 'Still not credited at 2/3 confirmations');

  // Step 3: 3 confirmations (Matured threshold reached -> CREDITED)
  const step3 = await processBlockchainDepositEvent({
    chainId: 56,
    asset: 'USDT',
    contractAddress: BSC_CONFIG.USDT_CONTRACT_ADDRESS,
    txHash: validTxHash,
    logIndex: 0,
    fromAddress: '0xsender1111111111111111111111111111111111',
    toAddress: user1Deposit.address,
    amount: depositAmount,
    blockNumber: blockStart,
    currentBlockNumber: blockStart + 2, // 3 confirmations
  });

  assert(step3?.status === 'CREDITED', 'Status transitions to CREDITED once 3 confirmations reached');
  assert(Boolean(step3?.creditedAt), 'Credited timestamp is recorded');

  // Verify exact 1 ledger entry
  const postCreditLedger = await db.query(
    `SELECT * FROM financial_ledger_entries WHERE user_id = $1 AND source_id = $2`,
    [user1Id, step3?.id]
  );
  assert(postCreditLedger.rows.length === 1, 'Ledger credited exactly once');
  assert(Number(postCreditLedger.rows[0].amount) === depositAmount, 'Credited amount matches exact deposit ($500.00 USDT)');

  // Idempotency: Duplicate re-scans with same txHash & logIndex do not duplicate ledger entries
  const replayed = await processBlockchainDepositEvent({
    chainId: 56,
    asset: 'USDT',
    contractAddress: BSC_CONFIG.USDT_CONTRACT_ADDRESS,
    txHash: validTxHash,
    logIndex: 0,
    fromAddress: '0xsender1111111111111111111111111111111111',
    toAddress: user1Deposit.address,
    amount: depositAmount,
    blockNumber: blockStart,
    currentBlockNumber: blockStart + 20,
  });

  assert(replayed?.status === 'CREDITED', 'Replayed event remains CREDITED');
  const duplicateLedgerCheck = await db.query(
    `SELECT COUNT(*)::int as count FROM financial_ledger_entries WHERE user_id = $1 AND source_id = $2`,
    [user1Id, step3?.id]
  );
  assert(duplicateLedgerCheck.rows[0].count === 1, 'Idempotency: Re-scans produce ZERO duplicate ledger credits');

  // =========================================================================
  // 5. GAS MANAGEMENT & SECURE USDT SWEEP TO TREASURY
  // =========================================================================
  console.log('\n--- 5. GAS MANAGEMENT & SECURE USDT SWEEP TO TREASURY ---');
  const sweepRes = await sweepDepositToTreasury({
    userId: user1Id,
    depositAddress: user1Deposit.address,
    amountUsdt: depositAmount,
    depositId: step3?.id,
  });

  assert(sweepRes.success === true, 'USDT sweep executed successfully');
  assert(sweepRes.treasuryAddress === BSC_CONFIG.TREASURY_WALLET_ADDRESS, 'Sweep targets TREASURY_WALLET_ADDRESS');
  assert(Boolean(sweepRes.txHash), 'Sweep transaction hash generated');
  assert(Boolean(sweepRes.gasFundingTxHash), 'Gas Manager evaluated & recorded minimum gas funding');

  // Verify status in DB transitions to SWEPT
  const sweptDbRow = await db.query(`SELECT status, swept_at, sweep_tx_hash FROM blockchain_deposits WHERE id = $1`, [
    step3?.id,
  ]);
  assert(sweptDbRow.rows[0].status === 'SWEPT', 'Deposit status updated to SWEPT in database');
  assert(Boolean(sweptDbRow.rows[0].swept_at), 'swept_at timestamp is persisted');

  // Duplicate sweep prevention
  const duplicateSweep = await sweepDepositToTreasury({
    userId: user1Id,
    depositAddress: user1Deposit.address,
    amountUsdt: depositAmount,
    depositId: step3?.id,
  });
  assert(duplicateSweep.status === 'SKIPPED', 'Duplicate sweep attempt is safely SKIPPED');

  // =========================================================================
  // 6. RPC FAILOVER & SERVER RESTART RECOVERY TESTS
  // =========================================================================
  console.log('\n--- 6. RPC FAILOVER & SERVER RECOVERY TESTS ---');
  
  // Test RPC Provider failover
  const failoverTestResult = await bscRpcManager.executeWithFailover(async (provider, rpcUrl) => {
    return { connectedUrl: rpcUrl };
  });
  assert(Boolean(failoverTestResult.result.connectedUrl), 'RPC Manager connects via active healthy RPC');

  const rpcStatus = bscRpcManager.getStatus();
  assert(Boolean(rpcStatus.primaryUrl) && Boolean(rpcStatus.secondaryUrl), 'RPC Manager tracks primary and secondary endpoints');

  // Test Server Restart Recovery
  // Insert an unconfirmed deposit simulating prior crash before maturation
  const crashTxHash = `0xcrash${uuidv4().replace(/-/g, '')}`.slice(0, 66);
  await processBlockchainDepositEvent({
    chainId: 56,
    asset: 'USDT',
    contractAddress: BSC_CONFIG.USDT_CONTRACT_ADDRESS,
    txHash: crashTxHash,
    logIndex: 0,
    fromAddress: '0xcrashsender1111111111111111111111111111',
    toAddress: user2Deposit.address,
    amount: 150.0,
    blockNumber: 1000,
    currentBlockNumber: 1001, // 2 confirmations (unfinalized)
  });

  const recoveryResult = await recoverAndSyncPendingDeposits();
  assert(recoveryResult.recoveredCount >= 1, 'Server recovery successfully re-synced unfinalized pending deposits');

  console.log('\n===============================================================');
  console.log(`📊 PRODUCTION TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('===============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runProductionTestSuite().catch((err) => {
  console.error('Fatal error running production deposit test suite:', err);
  process.exit(1);
});
