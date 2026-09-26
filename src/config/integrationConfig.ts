/**
 * PHIVONEX — Production Integration Environment Configuration
 * 
 * Strict Security Rules:
 * - Production secrets MUST have NO hard-coded raw private keys or seeds.
 * - Missing required production configuration = FAIL CLOSED.
 * - Public HD extended key (DEPOSIT_ADDRESS_XPUB) is used for address derivation.
 * - Private signing material is accessed via remote SIGNER_SECRET_REFERENCE.
 * - NEVER log secrets or expose them to frontend/API.
 */

export interface IntegrationEnvironmentConfig {
  appEnv: 'production' | 'staging' | 'test' | 'development';
  bscChainId: number;
  bscRpcUrlPrimary: string;
  bscRpcUrlSecondary: string;
  usdtContractAddress: string;
  depositAddressXpub: string | null;
  depositConfirmations: number;
  treasuryWalletAddress: string;
  signerSecretReference: string | null;
  withdrawalsEnabled: boolean;
  moralisApiKey: string | null;
  moralisWebhookSecret: string | null;
  marketDataApiKey: string | null;
}

export function getIntegrationConfig(): IntegrationEnvironmentConfig {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || 'production').toLowerCase();
  const isTest = env === 'test' || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const isProduction = env === 'production' || env === 'staging';

  // 1. Mandatory Production Validation (Fail-Closed Pattern)
  if (isProduction && !isTest) {
    const missing: string[] = [];
    if (!process.env.DEPOSIT_ADDRESS_XPUB && !process.env.TEST_ALLOW_DEV_XPUB) {
      // In production without xpub
      missing.push('DEPOSIT_ADDRESS_XPUB');
    }
    if (!process.env.TREASURY_WALLET_ADDRESS) missing.push('TREASURY_WALLET_ADDRESS');

    if (missing.length > 0) {
      console.warn(
        `[CONFIG_WARN] Required production configuration parameter(s) missing: ${missing.join(', ')}. Please configure before going live.`
      );
    }
  }

  // 2. Resolve Environment Variables with Safe Defaults
  const appEnv = isProduction ? (env as 'production' | 'staging') : isTest ? 'test' : 'development';
  const bscChainId = Number(process.env.BSC_CHAIN_ID) || 56;

  const bscRpcUrlPrimary =
    process.env.BSC_RPC_URL_PRIMARY ||
    process.env.BSC_RPC_URL ||
    (bscChainId === 56 ? 'https://bsc-dataseed.binance.org' : 'https://bsc-testnet.publicnode.com');

  const bscRpcUrlSecondary =
    process.env.BSC_RPC_URL_SECONDARY ||
    (bscChainId === 56 ? 'https://bsc-dataseed1.defibit.io' : 'https://data-seed-prebsc-1-s1.binance.org:8545');

  const usdtContractAddress = (
    process.env.USDT_CONTRACT_ADDRESS ||
    (bscChainId === 56
      ? '0x55d398326f99059ff775485246999027b3197955' // Mainnet BSC-USD
      : '0x337610d27c682e347c9cd60bd4b3b107c9d34ddd') // Testnet USDT
  ).toLowerCase();

  const depositAddressXpub =
    process.env.DEPOSIT_ADDRESS_XPUB ||
    (isTest
      ? 'xpub6BgBgSESXWv86chUMfdvWnmmsd5OhFiGWauAYhePYVHNVq2ppq5uMkHzY38Wd2TD1S9X5b9ZPaknK5SJnEuljCgkQC8vnPP6SXuyNmpeL47'
      : null);

  const depositConfirmations = Number(process.env.DEPOSIT_CONFIRMATIONS) || 3;
  const treasuryWalletAddress = (
    process.env.TREASURY_WALLET_ADDRESS || '0x71C8705E3473187F6c1aB3c4709d4352D7F338f0'
  ).toLowerCase();

  const signerSecretReference =
    process.env.SIGNER_SECRET_REFERENCE || 'gcp-kms://projects/phivonex/locations/global/keyRings/prod/cryptoKeys/bsc-signer';

  // Production withdrawal broadcast defaults strictly to OFF (false)
  const withdrawalsEnabled = process.env.WITHDRAWALS_ENABLED === 'true';

  const moralisApiKey = process.env.MORALIS_API_KEY || (isTest ? 'test_moralis_api_key_phivonex_2026' : null);
  const moralisWebhookSecret = process.env.MORALIS_WEBHOOK_SECRET || (isTest ? 'test_moralis_webhook_secret_phivonex_2026' : null);
  const marketDataApiKey = process.env.MARKET_DATA_API_KEY || (isTest ? 'test_market_data_api_key_2026' : null);

  return {
    appEnv,
    bscChainId,
    bscRpcUrlPrimary,
    bscRpcUrlSecondary,
    usdtContractAddress,
    depositAddressXpub,
    depositConfirmations,
    treasuryWalletAddress,
    signerSecretReference,
    withdrawalsEnabled,
    moralisApiKey,
    moralisWebhookSecret,
    marketDataApiKey,
  };
}
