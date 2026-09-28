import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { depositLimiter } from '../middleware/rateLimiter';
import { getOrCreateUserDepositAddress } from '../services/bscKeyService';
import { getUserDeposits, processBlockchainDepositEvent } from '../services/bscDepositService';
import { rescanUserDepositStatus } from '../services/bscListenerService';
import { BSC_CONFIG } from '../../config/bscConfig';
import { bscRpcManager } from '../providers/bscRpcProvider';
import { getDb } from '../db/db';
import { ethers } from 'ethers';
import { v4 as uuidv4 } from 'uuid';
import { generateDepositPublicId } from '../utils/idGenerator';
import { postLedgerCredit } from '../services/walletLedgerService';
import { notifyUsdtDepositConfirmed } from '../services/notificationService';

export const depositRouter = Router();

/**
 * GET /api/deposits/address
 * Returns the authenticated user's unique deposit address for BNB or USDT on BNB Smart Chain.
 */
depositRouter.get('/address', requireAuth, depositLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const requestedAsset = ((req.query.asset as string) || 'BNB').toUpperCase();
    const targetAsset = requestedAsset === 'USDT' ? 'USDT' : 'BNB';

    const addressRecord = await getOrCreateUserDepositAddress(userId, targetAsset);

    const isUsdt = targetAsset === 'USDT';
    const networkDisplayName = isUsdt ? 'BNB Smart Chain (BEP-20)' : BSC_CONFIG.NETWORK_NAME;
    const assetWarning = isUsdt
      ? `Send USDT (BEP-20) on BNB Smart Chain (Chain ID: ${BSC_CONFIG.CHAIN_ID}) only. Do not send USDT via ERC-20, TRC-20, or other networks.`
      : `Send native BNB on ${BSC_CONFIG.NETWORK_NAME} (Chain ID: ${BSC_CONFIG.CHAIN_ID}) only. Do not send other assets to this address.`;

    res.status(200).json({
      success: true,
      data: {
        address: addressRecord.address,
        chainId: addressRecord.chainId,
        asset: targetAsset,
        networkName: networkDisplayName,
        requiredConfirmations: BSC_CONFIG.REQUIRED_CONFIRMATIONS,
        explorerUrl: `${BSC_CONFIG.EXPLORER_ADDRESS_URL}${addressRecord.address}`,
        derivationReference: addressRecord.derivationReference,
        warning: assetWarning,
        note: `BNB and USDT deposit balances are tracked separately in your financial ledger. Both BNB and USDT balances can be used directly to purchase & activate Genesis Nodes.`,
      },
    });
  } catch (err: any) {
    console.error('[Deposit API] Error retrieving deposit address:', err);
    res.status(500).json({
      success: false,
      error: 'FAILED_TO_GET_ADDRESS',
      message: err?.message || 'Could not retrieve user deposit address',
    });
  }
});

/**
 * GET /api/deposits/me
 * Returns paginated deposit history and summary for the authenticated user.
 */
depositRouter.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const statusFilter = req.query.status as string | undefined;

    const result = await getUserDeposits(userId, page, limit, statusFilter);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[Deposit API] Error retrieving deposit history:', err);
    res.status(500).json({
      success: false,
      error: 'FAILED_TO_GET_DEPOSITS',
      message: err?.message || 'Could not retrieve deposit history',
    });
  }
});

/**
 * POST /api/deposits/rescan
 * Triggers an on-demand check/rescan of pending transactions for the authenticated user.
 */
depositRouter.post('/rescan', requireAuth, depositLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const result = await rescanUserDepositStatus(userId);

    const deposits = await getUserDeposits(userId, 1, 20);

    res.status(200).json({
      success: true,
      message: 'Deposit scan completed successfully',
      data: {
        ...result,
        recentDeposits: deposits.deposits,
        summary: deposits.summary,
      },
    });
  } catch (err: any) {
    console.error('[Deposit API] Error during rescan:', err);
    res.status(500).json({
      success: false,
      error: 'RESCAN_FAILED',
      message: err?.message || 'Deposit rescan failed',
    });
  }
});

/**
 * POST /api/deposits/simulate-test-deposit
 * Automated test / development endpoint to simulate a blockchain deposit event.
 */
depositRouter.post('/simulate-test-deposit', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { amount, txHash, fromAddress, confirmations, blockNumber, currentBlockNumber, asset } = req.body;
    const targetAsset = (asset || 'BNB').toUpperCase() === 'USDT' ? 'USDT' : 'BNB';

    const userAddress = await getOrCreateUserDepositAddress(userId, targetAsset);
    const simulatedBlock = blockNumber || 38291000;
    const confs = confirmations !== undefined ? Number(confirmations) : BSC_CONFIG.REQUIRED_CONFIRMATIONS;
    const currentBlock = currentBlockNumber || (simulatedBlock + confs - 1);
    const hash = txHash || `0xsim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const from = fromAddress || '0x1111111111111111111111111111111111111111';

    const deposit = await processBlockchainDepositEvent({
      chainId: BSC_CONFIG.CHAIN_ID,
      asset: targetAsset,
      txHash: hash,
      fromAddress: from,
      toAddress: userAddress.address,
      amount: Number(amount || 1.0),
      blockNumber: simulatedBlock,
      currentBlockNumber: currentBlock,
    });

    res.status(200).json({
      success: true,
      message: `Simulated ${targetAsset} deposit event processed`,
      data: deposit,
    });
  } catch (err: any) {
    console.error('[Deposit API] Error simulating deposit:', err);
    res.status(500).json({
      success: false,
      error: 'SIMULATION_FAILED',
      message: err?.message || 'Failed to simulate deposit',
    });
  }
});

/**
 * POST /api/deposits/submit-txhash
 * Allows users to submit their on-chain transaction hash for instant blockchain verification and account crediting.
 */
depositRouter.post('/submit-txhash', requireAuth, depositLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { txHash, asset } = req.body;

    if (!txHash || typeof txHash !== 'string') {
      res.status(400).json({
        success: false,
        error: 'INVALID_TX_HASH',
        message: 'Please provide a valid transaction hash (TxHash / TxID).',
      });
      return;
    }

    const cleanTxHash = txHash.trim().toLowerCase();
    const txHashRegex = /^0x[a-f0-9]{64}$/;
    if (!txHashRegex.test(cleanTxHash)) {
      res.status(400).json({
        success: false,
        error: 'INVALID_TX_FORMAT',
        message: 'Transaction hash must be a 66-character hex string starting with 0x.',
      });
      return;
    }

    const requestedAsset = ((asset as string) || 'USDT').toUpperCase() === 'BNB' ? 'BNB' : 'USDT';
    const db = await getDb();

    // 1. Check if this txHash has ALREADY been submitted, processed, or credited globally in DB, Ledger, or Firestore
    const existing = await db.query(
      `SELECT id, user_id, status, amount, asset FROM blockchain_deposits WHERE LOWER(tx_hash) = $1 LIMIT 1`,
      [cleanTxHash]
    );

    if (existing.rows.length > 0) {
      res.status(409).json({
        success: false,
        error: 'TX_ALREADY_USED',
        message: 'This transaction hash has already been submitted and credited on PHIVONEX. Re-submitting transaction hashes is strictly prohibited for life.',
      });
      return;
    }

    const existingLedger = await db.query(
      `SELECT id FROM financial_ledger_entries WHERE description ILIKE $1 OR source_ref ILIKE $1 LIMIT 1`,
      [`%${cleanTxHash}%`]
    );

    if (existingLedger.rows.length > 0) {
      res.status(409).json({
        success: false,
        error: 'TX_ALREADY_CREDITED',
        message: 'This transaction hash has already been credited in the financial ledger and cannot be reused.',
      });
      return;
    }

    try {
      const { adminFirestore } = await import('../../lib/firebase-admin');
      const fsSnap = await adminFirestore.collection('blockchain_deposits').where('txHash', '==', cleanTxHash).limit(1).get();
      if (!fsSnap.empty) {
        res.status(409).json({
          success: false,
          error: 'TX_ALREADY_USED_FIRESTORE',
          message: 'This transaction hash has already been processed and saved in real-time audit storage. Re-submitting is prohibited.',
        });
        return;
      }
    } catch (fsErr) {
      console.warn('[Deposit API] Firestore transaction hash uniqueness check warning:', fsErr);
    }

    // 2. Query BNB Smart Chain node for transaction receipt using resilient multi-RPC fallback
    const rpcEndpoints = [
      'https://bsc-dataseed.binance.org',
      'https://bsc-rpc.publicnode.com',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-dataseed2.binance.org',
      BSC_CONFIG.RPC_URL_PRIMARY,
      BSC_CONFIG.RPC_URL_SECONDARY,
    ].filter((url) => Boolean(url) && !url.endsWith('rpc.ankr.com/bsc') && !url.endsWith('rpc.ankr.com/bsc/'));

    const uniqueRpcs = Array.from(new Set(rpcEndpoints));

    let receipt: ethers.TransactionReceipt | null = null;
    let tx: ethers.TransactionResponse | null = null;
    let currentBlock = 0;

    for (const rpc of uniqueRpcs) {
      try {
        const network = ethers.Network.from(BSC_CONFIG.CHAIN_ID);
        const p = new ethers.JsonRpcProvider(rpc, network, { staticNetwork: network });
        const [r, t] = await Promise.all([
          p.getTransactionReceipt(cleanTxHash),
          p.getTransaction(cleanTxHash),
        ]);
        if (r && t) {
          receipt = r;
          tx = t;
          try {
            currentBlock = await p.getBlockNumber();
          } catch {
            currentBlock = receipt.blockNumber + 3;
          }
          console.log(`[Deposit API] Successfully resolved on-chain transaction from ${rpc}!`);
          break;
        }
      } catch (err: any) {
        console.warn(`[Deposit API] RPC ${rpc} query error:`, err?.message || err);
      }
    }

    if (!receipt || !tx) {
      res.status(404).json({
        success: false,
        error: 'TX_NOT_FOUND',
        message: 'Transaction not found on BNB Smart Chain yet. Please wait a few seconds for BSC miners to process the transaction and try again.',
      });
      return;
    }

    if (receipt.status !== 1) {
      res.status(400).json({
        success: false,
        error: 'TX_FAILED_ON_CHAIN',
        message: 'This transaction failed or was reverted on the BNB Smart Chain blockchain.',
      });
      return;
    }

    const blockNumber = receipt.blockNumber;
    const confirmations = Math.max(1, (currentBlock || (blockNumber + 3)) - blockNumber + 1);

    // 3. Resolve destination & verify recipient is our Treasury wallet or user assigned address
    const officialFallback = '0x39F47C356d45eA49826a76C252794c4C83572D76'.toLowerCase();
    const treasury = (BSC_CONFIG.TREASURY_WALLET_ADDRESS || process.env.TREASURY_WALLET_ADDRESS || officialFallback).toLowerCase();

    const userAddrRes = await db.query(
      `SELECT deposit_address FROM user_deposit_addresses WHERE user_id = $1`,
      [userId]
    ).catch(() => ({ rows: [] }));
    const validRecipients = new Set<string>([
      treasury,
      officialFallback,
      ...userAddrRes.rows.map((r: any) => (r.deposit_address || '').toLowerCase()).filter(Boolean)
    ]);

    let detectedAmount = 0;
    let detectedAsset = requestedAsset;
    let fromAddress = tx.from.toLowerCase();
    let toAddress = '';

    // Check for USDT BEP-20 transfer
    const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
    const usdtContractLower = BSC_CONFIG.USDT_CONTRACT_ADDRESS.toLowerCase();

    for (const log of receipt.logs) {
      if (log.topics[0] === transferEventSignature && log.topics.length >= 3) {
        const logContract = log.address.toLowerCase();
        const recipientTopic = '0x' + log.topics[2].slice(26);
        const recipientAddress = recipientTopic.toLowerCase();

        // Check if recipient matches Treasury address or user assigned address
        const isRecipientValid =
          validRecipients.has(recipientAddress) ||
          recipientAddress === treasury ||
          recipientAddress === officialFallback;

        if (logContract === usdtContractLower && isRecipientValid) {
          try {
            const rawAmount = BigInt(log.data);
            const formatted = Number(ethers.formatUnits(rawAmount, 18));
            if (formatted > 0) {
              detectedAmount = formatted;
              detectedAsset = 'USDT';
              toAddress = recipientAddress;
              fromAddress = ('0x' + log.topics[1].slice(26)).toLowerCase();
              break;
            }
          } catch (parseErr) {
            console.error('[Deposit API] Error parsing ERC-20 transfer log:', parseErr);
          }
        }
      }
    }

    // Check for Native BNB transfer
    if (detectedAmount === 0 && tx.value > 0n) {
      const recipientAddress = (tx.to || '').toLowerCase();
      const isRecipientValid =
        validRecipients.has(recipientAddress) ||
        recipientAddress === treasury ||
        recipientAddress === officialFallback;

      if (isRecipientValid) {
        detectedAmount = Number(ethers.formatEther(tx.value));
        detectedAsset = 'BNB';
        toAddress = recipientAddress;
      }
    }

    if (detectedAmount <= 0) {
      res.status(400).json({
        success: false,
        error: 'NO_VALID_TRANSFER',
        message: `No qualifying ${requestedAsset} transfer to the platform treasury was found in this transaction. Please ensure you sent to the correct address.`,
      });
      return;
    }

    // 4. Record deposit in blockchain_deposits
    const depositId = uuidv4();
    const publicDepositId = generateDepositPublicId();
    const now = new Date();

    const insertRes = await db.query(
      `
      INSERT INTO blockchain_deposits (
        id, public_deposit_id, user_id, chain_id, asset,
        tx_hash, log_index, from_address, to_address, amount, block_number,
        confirmations, status, detected_at, confirmed_at, credited_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'CREDITED', $13, $13, $13, $13, $13)
      ON CONFLICT (chain_id, tx_hash, log_index, to_address) DO UPDATE
        SET status = 'CREDITED',
            credited_at = COALESCE(blockchain_deposits.credited_at, EXCLUDED.credited_at),
            updated_at = CURRENT_TIMESTAMP
      RETURNING id, public_deposit_id
      `,
      [
        depositId,
        publicDepositId,
        userId,
        BSC_CONFIG.CHAIN_ID,
        detectedAsset,
        cleanTxHash,
        0,
        fromAddress,
        toAddress || treasury,
        detectedAmount,
        blockNumber,
        confirmations,
        now,
      ]
    );

    const actualDepositId = insertRes.rows[0]?.id || depositId;
    const actualPublicDepositId = insertRes.rows[0]?.public_deposit_id || publicDepositId;

    // 5. Post financial ledger credit (idempotent via unique constraint on source_type, source_id, entry_type)
    await postLedgerCredit({
      userId,
      sourceType: 'BLOCKCHAIN_DEPOSIT',
      sourceId: actualDepositId,
      sourceRef: actualPublicDepositId,
      amount: detectedAmount,
      description: `On-chain ${detectedAsset} deposit verified via TxHash ${cleanTxHash.slice(0, 10)}...`,
      currency: detectedAsset,
    });

    // 6. Sync to Firestore for cloud persistence
    try {
      const { adminFirestore } = await import('../../lib/firebase-admin');
      await adminFirestore.collection('blockchain_deposits').doc(depositId).set({
        id: depositId,
        publicDepositId,
        userId,
        txHash: cleanTxHash,
        amount: detectedAmount,
        asset: detectedAsset,
        status: 'CREDITED',
        createdAt: now.toISOString(),
      }, { merge: true });
    } catch (fsErr) {
      console.warn('[Deposit API] Firestore deposit backup notice:', fsErr);
    }

    // 7. Notify user
    try {
      await notifyUsdtDepositConfirmed({
        userId,
        amountUsdt: detectedAmount,
        depositId,
        txHash: cleanTxHash,
      });
    } catch {
      // Non-critical notification failure
    }

    res.status(200).json({
      success: true,
      message: `Deposit verified successfully! Credited ${detectedAmount} ${detectedAsset} to your account.`,
      data: {
        publicDepositId,
        amount: detectedAmount,
        asset: detectedAsset,
        txHash: cleanTxHash,
        confirmations,
        status: 'CREDITED',
      },
    });
  } catch (err: any) {
    console.error('[Deposit API] Error processing submitted TxHash:', err);
    res.status(500).json({
      success: false,
      error: 'VERIFICATION_ERROR',
      message: err?.message || 'Failed to verify transaction hash.',
    });
  }
});
