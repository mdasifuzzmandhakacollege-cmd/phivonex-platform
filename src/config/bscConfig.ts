/**
 * PHIVONEX — BNB Smart Chain (BSC) Configuration
 * Task #17.1 Server-side Network and Protocol Configuration
 * 
 * Strict Server-Side Security:
 * Network parameters, RPCs, and confirmation rules are authoritative
 * and NEVER accepted from user or client requests.
 */

export const BSC_CONFIG = {
  // BSC Chain ID: Default to 97 (BNB Smart Chain Testnet), 56 for Mainnet
  CHAIN_ID: Number(process.env.BSC_CHAIN_ID) || 97,

  // Human-readable network title
  get NETWORK_NAME(): string {
    return this.CHAIN_ID === 56 ? 'BNB Smart Chain Mainnet' : 'BNB Smart Chain Testnet';
  },

  // Primary JSON-RPC endpoint for BNB Smart Chain
  RPC_URL: process.env.BSC_RPC_URL || 'https://bsc-testnet.publicnode.com',

  // Number of on-chain confirmations required before ledger credit
  REQUIRED_CONFIRMATIONS: Number(process.env.BNB_REQUIRED_CONFIRMATIONS) || 3,

  // Authoritative Hot Wallet / Treasury address for on-chain withdrawal settlements
  TREASURY_ADDRESS: (process.env.BNB_TREASURY_ADDRESS || '0x71C8705E3473187F6c1aB3c4709d4352D7F338f0').toLowerCase(),

  // Switch to control on-chain broadcast withdrawal execution
  get WITHDRAWALS_ENABLED(): boolean {
    if (process.env.BNB_WITHDRAWALS_ENABLED === 'true' || process.env.ENABLE_WITHDRAWALS === 'true') {
      return true;
    }
    if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
      return true;
    }
    return false;
  },

  // Master Root Seed / Secret for deterministic user deposit address derivation
  // In production, loaded from secure HSM / KMS / Secret Manager
  get MASTER_DERIVATION_SEED(): string {
    const seed = process.env.BNB_MASTER_SEED;
    if (seed && seed.trim().length > 0) {
      return seed.trim();
    }
    if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
      return 'phivonex_test_only_deterministic_derivation_seed_2026';
    }
    throw new Error('FATAL_SECURITY_ERROR: BNB_MASTER_SEED environment variable is required in production mode. System failing closed.');
  },

  // Block explorer URLs
  get EXPLORER_TX_URL(): string {
    return this.CHAIN_ID === 56 ? 'https://bscscan.com/tx/' : 'https://testnet.bscscan.com/tx/';
  },

  get EXPLORER_ADDRESS_URL(): string {
    return this.CHAIN_ID === 56 ? 'https://bscscan.com/address/' : 'https://testnet.bscscan.com/address/';
  },

  // Asset Identifier
  ASSET: 'BNB',
  DECIMALS: 18,
};
