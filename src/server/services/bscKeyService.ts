import { ethers } from 'ethers';
import { BSC_CONFIG } from '../../config/bscConfig';
import { getDb } from '../db/db';
import { v4 as uuidv4 } from 'uuid';

export interface UserDepositAddressRecord {
  id: string;
  userId: string;
  chainId: number;
  asset: string;
  address: string;
  derivationReference: string;
  createdAt: string;
}

/**
 * Derive a unique, valid EVM/BNB deposit address for a given user.
 * 
 * SECURITY INVARIANT:
 * Raw private keys are NEVER stored in the database.
 * Address is computed deterministically from master derivation key + user UUID.
 */
export function deriveUserBnbAddress(userId: string): { address: string; derivationReference: string } {
  // Use ethers HD derivation or deterministic keccak256 seed
  const entropy = ethers.keccak256(
    ethers.toUtf8Bytes(`${BSC_CONFIG.MASTER_DERIVATION_SEED}:${userId}:${BSC_CONFIG.CHAIN_ID}`)
  );
  
  // Create an ephemeral signing wallet in memory to get the authoritative address
  const wallet = new ethers.Wallet(entropy);
  const checksumAddress = ethers.getAddress(wallet.address);
  const derivationReference = `m/44'/60'/0'/0/uid-${userId.slice(0, 8)}`;

  return {
    address: checksumAddress,
    derivationReference,
  };
}

/**
 * Get or provision a user's unique deposit address for BNB or USDT.
 * Idempotent: Subsequent calls return the existing database record.
 */
export async function getOrCreateUserDepositAddress(
  userId: string,
  requestedAsset: string = 'BNB'
): Promise<UserDepositAddressRecord> {
  const db = await getDb();
  const assetName = requestedAsset.toUpperCase() === 'USDT' ? 'USDT' : 'BNB';

  // 1. Check existing
  const existing = await db.query<any>(
    `
    SELECT id, user_id, chain_id, asset, address, derivation_reference, created_at
    FROM user_deposit_addresses
    WHERE user_id = $1 AND chain_id = $2 AND (asset = $3 OR address IS NOT NULL)
    ORDER BY CASE WHEN asset = $3 THEN 1 ELSE 2 END
    LIMIT 1
    `,
    [userId, BSC_CONFIG.CHAIN_ID, assetName]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      chainId: row.chain_id,
      asset: assetName,
      address: row.address,
      derivationReference: row.derivation_reference,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  // 2. Derive unique address
  const { address, derivationReference } = deriveUserBnbAddress(userId);
  const id = uuidv4();

  // 3. Persist (without any private key)
  const insertRes = await db.query<any>(
    `
    INSERT INTO user_deposit_addresses (
      id, user_id, chain_id, asset, address, derivation_reference, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, chain_id, asset) DO UPDATE
      SET address = EXCLUDED.address
    RETURNING id, user_id, chain_id, asset, address, derivation_reference, created_at
    `,
    [id, userId, BSC_CONFIG.CHAIN_ID, assetName, address, derivationReference]
  );

  const row = insertRes.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    chainId: row.chain_id,
    asset: row.asset,
    address: row.address,
    derivationReference: row.derivation_reference,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Find the user_id that owns a specific deposit address on this chain.
 */
export async function findUserByDepositAddress(address: string, chainId = BSC_CONFIG.CHAIN_ID): Promise<string | null> {
  const db = await getDb();
  const normalized = ethers.getAddress(address);

  const res = await db.query<{ user_id: string }>(
    `
    SELECT user_id 
    FROM user_deposit_addresses 
    WHERE LOWER(address) = LOWER($1) AND chain_id = $2
    `,
    [normalized, chainId]
  );

  if (res.rows.length === 0) return null;
  return res.rows[0].user_id;
}
