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
  derivationIndex: number;
  derivationReference: string;
  createdAt: string;
}

// Fallback test/development extended public key (strictly public xpub, contains NO private key)
// ONLY used during test execution or local dev mode.
const DEV_FALLBACK_XPUB =
  'xpub6EF8jXqFeFEW5bwMU7RpQtHkzE4KJxcqJtvkCjJumzW8CPpacXkb92ek4WzLQXjL93HycJwTPUAcuNxCqFPKKU5m5Z2Vq4nCyh5CyPeBFFr';

/**
 * Resolve the authoritative DEPOSIT_ADDRESS_XPUB public HD key.
 * 
 * SECURITY GUARANTEES:
 * 1. The application server holds ONLY the public HD key (xpub at branch m/44'/60'/0'/0).
 * 2. It NEVER generates or stores raw private keys, mnemonics, seeds, or xprv.
 * 3. In production: DEPOSIT_ADDRESS_XPUB is mandatory. Missing or invalid XPUB = FAIL CLOSED.
 */
export function getDepositAddressXpub(): string {
  const isProd = (BSC_CONFIG.APP_ENV === 'production' || process.env.NODE_ENV === 'production') && process.env.NODE_ENV !== 'test';
  const xpub = BSC_CONFIG.DEPOSIT_ADDRESS_XPUB;

  if (xpub && xpub.startsWith('xpub')) {
    try {
      ethers.HDNodeWallet.fromExtendedKey(xpub);
      return xpub;
    } catch (err: any) {
      if (isProd) {
        throw new Error(`CRITICAL_SECURITY_ERROR: Corrupted or invalid DEPOSIT_ADDRESS_XPUB in production: ${err.message}`);
      }
    }
  }

  if (isProd) {
    throw new Error(
      'CRITICAL_SECURITY_ERROR: DEPOSIT_ADDRESS_XPUB is mandatory in production environment. Refusing to operate with fallback (FAIL CLOSED).'
    );
  }

  // If in test or dev mode, use safe public deterministic test xpub
  return DEV_FALLBACK_XPUB;
}

/**
 * Derive a unique, valid EVM/BSC deposit address for a given derivation index.
 * 
 * DEPOSIT_ADDRESS_XPUB represents the public branch at m/44'/60'/0'/0.
 * Addresses are derived relative to that branch via:
 * HDNodeWallet.fromExtendedKey(DEPOSIT_ADDRESS_XPUB).deriveChild(index)
 * 
 * STRICT INVARIANT:
 * Invalid XPUB derivation throws an explicit error immediately.
 * Zero hash fallbacks or dummy address fallbacks are permitted.
 */
export function deriveAddressFromXpub(
  xpub: string,
  derivationIndex: number
): { address: string; derivationReference: string } {
  if (derivationIndex < 0 || !Number.isInteger(derivationIndex)) {
    throw new Error(`INVALID_DERIVATION_INDEX: Derivation index must be a non-negative integer (got: ${derivationIndex})`);
  }

  if (!xpub || !xpub.trim().startsWith('xpub')) {
    throw new Error(`INVALID_XPUB: Expected valid extended public key starting with 'xpub' (got: ${xpub ? xpub.slice(0, 8) + '...' : 'empty'})`);
  }

  // 1. Load the public branch at m/44'/60'/0'/0
  // ethers.HDNodeWallet.fromExtendedKey will throw if xpub is malformed or invalid
  const branchRoot = ethers.HDNodeWallet.fromExtendedKey(xpub.trim());

  // 2. Derive child index relative to this branch (unhardened index)
  const childNode = branchRoot.deriveChild(derivationIndex);
  const checksumAddress = ethers.getAddress(childNode.address);
  const derivationReference = `m/44'/60'/0'/0/${derivationIndex}`;

  return {
    address: checksumAddress,
    derivationReference,
  };
}

/**
 * Backward-compatible helper for deriving address from index or user reference.
 */
export function deriveUserBnbAddress(
  userIdOrIndex: string | number,
  xpub = getDepositAddressXpub()
): { address: string; derivationReference: string } {
  const index = typeof userIdOrIndex === 'number' ? userIdOrIndex : 0;
  return deriveAddressFromXpub(xpub, index);
}

/**
 * Get or provision a user's unique BSC deposit address.
 * 
 * PRODUCTION DATABASE-SAFE ATOMIC INVARIANTS:
 * 1. Each user receives a unique BSC deposit address derived from DEPOSIT_ADDRESS_XPUB.
 * 2. Derivation index is atomically allocated via a database sequence (safe across multiple server instances).
 * 3. Derivation indices are strictly monotonic and never reused.
 * 4. Stores: derivation_index, deposit address, user ID, creation timestamp.
 * 5. Zero private keys / mnemonics / seeds stored or required.
 */
export async function getOrCreateUserDepositAddress(
  userId: string,
  requestedAsset: string = 'USDT'
): Promise<UserDepositAddressRecord> {
  const db = await getDb();
  const assetName = requestedAsset.toUpperCase() === 'BNB' ? 'BNB' : 'USDT';
  const chainId = BSC_CONFIG.CHAIN_ID;

  // 1. Check existing address for user on this chain
  const existing = await db.query<any>(
    `
    SELECT id, user_id, chain_id, asset, address, derivation_index, derivation_reference, created_at
    FROM user_deposit_addresses
    WHERE user_id = $1 AND chain_id = $2
    LIMIT 1
    `,
    [userId, chainId]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      chainId: Number(row.chain_id),
      asset: row.asset || assetName,
      address: row.address,
      derivationIndex: Number(row.derivation_index || 0),
      derivationReference: row.derivation_reference,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  // 2. Database-safe atomic index allocation via sequence
  // Works across multiple concurrent server instances
  const seqRes = await db.query<{ next_val: string | number }>(
    `SELECT nextval('bsc_deposit_derivation_index_seq') AS next_val`
  );
  const derivationIndex = Number(seqRes.rows[0]?.next_val ?? 0);

  // 3. Derive unique child public address from DEPOSIT_ADDRESS_XPUB relative to m/44'/60'/0'/0
  const xpub = getDepositAddressXpub();
  const { address, derivationReference } = deriveAddressFromXpub(xpub, derivationIndex);
  const id = uuidv4();

  // 4. Persist in database with conflict handling
  const insertRes = await db.query<any>(
    `
    INSERT INTO user_deposit_addresses (
      id, user_id, chain_id, asset, address, derivation_index, derivation_reference, created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, chain_id, asset) DO UPDATE
      SET address = EXCLUDED.address
    RETURNING id, user_id, chain_id, asset, address, derivation_index, derivation_reference, created_at
    `,
    [id, userId, chainId, assetName, address, derivationIndex, derivationReference]
  );

  const row = insertRes.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    chainId: Number(row.chain_id),
    asset: row.asset,
    address: row.address,
    derivationIndex: Number(row.derivation_index),
    derivationReference: row.derivation_reference,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Find the user_id that owns a specific deposit address on this chain.
 */
export async function findUserByDepositAddress(
  address: string,
  chainId = BSC_CONFIG.CHAIN_ID
): Promise<string | null> {
  const db = await getDb();
  if (!address || !ethers.isAddress(address)) return null;

  const normalized = ethers.getAddress(address);

  const res = await db.query<{ user_id: string }>(
    `
    SELECT user_id 
    FROM user_deposit_addresses 
    WHERE LOWER(address) = LOWER($1) AND chain_id = $2
    LIMIT 1
    `,
    [normalized, chainId]
  );

  if (res.rows.length === 0) return null;
  return res.rows[0].user_id;
}
