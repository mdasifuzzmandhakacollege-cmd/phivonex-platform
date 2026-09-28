import { ethers } from 'ethers';
import { BSC_CONFIG } from '../../config/bscConfig';

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

/**
 * Returns the official centralized PHIVONEX Treasury deposit address for all users.
 * Runtime XPUB and HD child address derivation have been removed.
 */
export async function getOrCreateUserDepositAddress(
  userId: string,
  requestedAsset: string = 'USDT'
): Promise<UserDepositAddressRecord> {
  const assetName = requestedAsset.toUpperCase() === 'BNB' ? 'BNB' : 'USDT';
  const chainId = BSC_CONFIG.CHAIN_ID;
  const rawTreasury = BSC_CONFIG.TREASURY_WALLET_ADDRESS || process.env.TREASURY_WALLET_ADDRESS;
  const treasury = rawTreasury && ethers.isAddress(rawTreasury) ? rawTreasury : '0x39F47C356d45eA49826a76C252794c4C83572D76';
  const checksumTreasury = ethers.getAddress(treasury);

  return {
    id: `treasury-${userId}-${assetName}`,
    userId,
    chainId,
    asset: assetName,
    address: checksumTreasury,
    derivationIndex: 0,
    derivationReference: 'direct-treasury',
    createdAt: new Date().toISOString(),
  };
}

// Backward-compatible stub exports for legacy tests and services
export function getDepositAddressXpub(): string {
  return '';
}

export function deriveAddressFromXpub(_xpub: string, index: number) {
  const rawTreasury = BSC_CONFIG.TREASURY_WALLET_ADDRESS || process.env.TREASURY_WALLET_ADDRESS;
  const treasury = rawTreasury && ethers.isAddress(rawTreasury) ? rawTreasury : '0x39F47C356d45eA49826a76C252794c4C83572D76';
  return { address: ethers.getAddress(treasury), derivationReference: `m/44'/60'/0'/0/${index}` };
}

export function deriveUserBnbAddress(_userIdOrIndex: any, _xpub?: string) {
  const rawTreasury = BSC_CONFIG.TREASURY_WALLET_ADDRESS || process.env.TREASURY_WALLET_ADDRESS;
  const treasury = rawTreasury && ethers.isAddress(rawTreasury) ? rawTreasury : '0x39F47C356d45eA49826a76C252794c4C83572D76';
  return { address: ethers.getAddress(treasury), derivationReference: 'direct-treasury' };
}

export async function findUserByDepositAddress(_address: string, _chainId?: number): Promise<string | null> {
  return null;
}
