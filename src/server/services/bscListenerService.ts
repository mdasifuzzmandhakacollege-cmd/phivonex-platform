import { ethers } from 'ethers';
import { BSC_CONFIG } from '../../config/bscConfig';
import { getDb } from '../db/db';
import { processBlockchainDepositEvent } from './bscDepositService';
import { getOrCreateUserDepositAddress } from './bscKeyService';

export interface ScanResult {
  scannedBlocks: number;
  detectedDeposits: number;
  fromBlock: number;
  toBlock: number;
  status: 'SUCCESS' | 'NO_NEW_BLOCKS' | 'ERROR';
  error?: string;
}

let isScanning = false;
let lastScannedBlock = 0;

/**
 * Scan on-chain transfers for all known user deposit addresses.
 */
export async function scanBlocksForDeposits(range = 10): Promise<ScanResult> {
  if (isScanning) {
    return {
      scannedBlocks: 0,
      detectedDeposits: 0,
      fromBlock: lastScannedBlock,
      toBlock: lastScannedBlock,
      status: 'SUCCESS',
    };
  }

  isScanning = true;

  try {
    const network = ethers.Network.from(BSC_CONFIG.CHAIN_ID);
    const provider = new ethers.JsonRpcProvider(BSC_CONFIG.RPC_URL, network, { staticNetwork: network });
    let currentBlock = 0;

    try {
      currentBlock = await provider.getBlockNumber();
    } catch (err: any) {
      // If RPC is unreachable or running in mock/isolated environment
      return {
        scannedBlocks: 0,
        detectedDeposits: 0,
        fromBlock: 0,
        toBlock: 0,
        status: 'ERROR',
        error: `RPC connection error: ${err?.message || 'Unreachable node'}`,
      };
    }

    if (lastScannedBlock === 0) {
      lastScannedBlock = Math.max(1, currentBlock - range);
    }

    const fromBlock = Math.max(1, lastScannedBlock + 1);
    const toBlock = Math.min(currentBlock, fromBlock + range);

    if (fromBlock > toBlock) {
      return {
        scannedBlocks: 0,
        detectedDeposits: 0,
        fromBlock: currentBlock,
        toBlock: currentBlock,
        status: 'NO_NEW_BLOCKS',
      };
    }

    // Get all registered deposit addresses
    const db = await getDb();
    const addrsRes = await db.query<{ address: string; user_id: string }>(
      `SELECT address, user_id FROM user_deposit_addresses WHERE chain_id = $1 AND asset = $2`,
      [BSC_CONFIG.CHAIN_ID, BSC_CONFIG.ASSET]
    );

    const addressMap = new Set(addrsRes.rows.map((r) => r.address.toLowerCase()));
    let detectedCount = 0;

    if (addressMap.size > 0) {
      for (let b = fromBlock; b <= toBlock; b++) {
        try {
          const block = await provider.getBlock(b, true);
          if (block && block.prefetchedTransactions) {
            for (const tx of block.prefetchedTransactions) {
              if (tx.to && addressMap.has(tx.to.toLowerCase()) && tx.value > 0n) {
                const amountBnb = Number(ethers.formatEther(tx.value));
                await processBlockchainDepositEvent({
                  chainId: BSC_CONFIG.CHAIN_ID,
                  txHash: tx.hash,
                  fromAddress: tx.from,
                  toAddress: tx.to,
                  amount: amountBnb,
                  blockNumber: b,
                  currentBlockNumber: currentBlock,
                });
                detectedCount++;
              }
            }
          }
        } catch (blockErr) {
          console.warn(`[BSC Listener] Error scanning block ${b}:`, blockErr);
        }
      }
    }

    lastScannedBlock = toBlock;

    return {
      scannedBlocks: toBlock - fromBlock + 1,
      detectedDeposits: detectedCount,
      fromBlock,
      toBlock,
      status: 'SUCCESS',
    };
  } finally {
    isScanning = false;
  }
}

/**
 * Trigger an immediate rescan of on-chain deposits for a specific user.
 * Fetches user's deposit address and verifies any unconfirmed or new transactions.
 */
export async function rescanUserDepositStatus(userId: string): Promise<{
  address: string;
  scanned: boolean;
  currentBlock: number;
}> {
  const depositRecord = await getOrCreateUserDepositAddress(userId);
  let currentBlock = 0;

  try {
    const provider = new ethers.JsonRpcProvider(BSC_CONFIG.RPC_URL, BSC_CONFIG.CHAIN_ID);
    currentBlock = await provider.getBlockNumber();

    // Re-verify pending/confirming deposits
    const db = await getDb();
    const pendingDeposits = await db.query<{
      tx_hash: string;
      from_address: string;
      to_address: string;
      amount: string | number;
      block_number: string | number;
    }>(
      `
      SELECT tx_hash, from_address, to_address, amount, block_number
      FROM blockchain_deposits
      WHERE user_id = $1 AND status IN ('DETECTED', 'CONFIRMING')
      `,
      [userId]
    );

    for (const dep of pendingDeposits.rows) {
      await processBlockchainDepositEvent({
        chainId: BSC_CONFIG.CHAIN_ID,
        txHash: dep.tx_hash,
        fromAddress: dep.from_address,
        toAddress: dep.to_address,
        amount: Number(dep.amount),
        blockNumber: Number(dep.block_number),
        currentBlockNumber: currentBlock,
      });
    }

    return {
      address: depositRecord.address,
      scanned: true,
      currentBlock,
    };
  } catch {
    return {
      address: depositRecord.address,
      scanned: false,
      currentBlock: 0,
    };
  }
}
