import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import { depositLimiter } from '../middleware/rateLimiter';
import { getOrCreateUserDepositAddress } from '../services/bscKeyService';
import { getUserDeposits, processBlockchainDepositEvent } from '../services/bscDepositService';
import { rescanUserDepositStatus } from '../services/bscListenerService';
import { BSC_CONFIG } from '../../config/bscConfig';

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
