/**
 * PHIVONEX — Task #23.2 Production Integration Environment Configuration
 * 
 * Strict Security Rules:
 * - Production secrets MUST have NO hard-coded fallback.
 * - Missing required production secret = FAIL CLOSED.
 * - Test environment may use explicit test-only deterministic values.
 * - NEVER log secrets or expose them to frontend/API.
 */

export interface IntegrationEnvironmentConfig {
  appEnv: 'production' | 'staging' | 'test' | 'development';
  bscChainId: number;
  bscRpcUrlPrimary: string;
  bscRpcUrlSecondary: string;
  usdtContractAddress: string;
  moralisApiKey: string | null;
  moralisWebhookSecret: string | null;
  marketDataApiKey: string | null;
  withdrawalsEnabled: boolean;
  signerSecretReference: string | null;
  masterDerivationSecretReference: string | null;
}

export function getIntegrationConfig(): IntegrationEnvironmentConfig {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
  const isTest = env === 'test' || process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  const isProduction = env === 'production' || env === 'staging';

  // 1. Mandatory Production Secret Validation (Fail-Closed Pattern)
  if (isProduction) {
    const missing: string[] = [];
    if (!process.env.BNB_MASTER_SEED && !process.env.MASTER_DERIVATION_SECRET_REFERENCE) missing.push('BNB_MASTER_SEED');
    if (!process.env.MORALIS_API_KEY) missing.push('MORALIS_API_KEY');
    if (!process.env.MORALIS_WEBHOOK_SECRET) missing.push('MORALIS_WEBHOOK_SECRET');

    if (missing.length > 0) {
      throw new Error(
        `FATAL_MISSING_PRODUCTION_SECRET: Required integration secret(s) missing in production mode: ${missing.join(', ')}. System failing closed.`
      );
    }
  }

  // 2. Resolve Environment Variables with Safe Defaults for Test/Dev
  const appEnv = isProduction ? (env as 'production' | 'staging') : isTest ? 'test' : 'development';

  const bscChainId = Number(process.env.BSC_CHAIN_ID) || (isProduction ? 56 : 97);

  const bscRpcUrlPrimary =
    process.env.BSC_RPC_URL_PRIMARY ||
    process.env.BSC_RPC_URL ||
    (bscChainId === 56 ? 'https://bsc-dataseed1.binance.org' : 'https://bsc-testnet.publicnode.com');

  const bscRpcUrlSecondary =
    process.env.BSC_RPC_URL_SECONDARY ||
    (bscChainId === 56 ? 'https://bsc-dataseed2.binance.org' : 'https://data-seed-prebsc-1-s1.binance.org:8545');

  const usdtContractAddress = (
    process.env.USDT_CONTRACT_ADDRESS ||
    (bscChainId === 56
      ? '0x55d398326f99059fF775485246999027B3197955' // Mainnet BSC-USD
      : '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd') // Testnet USDT
  ).toLowerCase();

  const moralisApiKey = process.env.MORALIS_API_KEY || (isTest ? 'test_moralis_api_key_phivonex_2026' : null);
  const moralisWebhookSecret = process.env.MORALIS_WEBHOOK_SECRET || (isTest ? 'test_moralis_webhook_secret_phivonex_2026' : null);
  const marketDataApiKey = process.env.MARKET_DATA_API_KEY || (isTest ? 'test_market_data_api_key_2026' : null);

  // Production withdrawal broadcast defaults strictly to OFF (false)
  const withdrawalsEnabled =
    (process.env.BNB_WITHDRAWALS_ENABLED === 'true' || process.env.WITHDRAWALS_ENABLED === 'true') &&
    process.env.NODE_ENV !== 'production';

  const signerSecretReference =
    process.env.SIGNER_SECRET_REFERENCE || process.env.BNB_TREASURY_PRIVATE_KEY || (isTest ? 'test_signer_secret_ref' : null);

  const masterDerivationSecretReference =
    process.env.MASTER_DERIVATION_SECRET_REFERENCE || process.env.BNB_MASTER_SEED || (isTest ? 'phivonex_test_only_deterministic_derivation_seed_2026' : null);

  return {
    appEnv,
    bscChainId,
    bscRpcUrlPrimary,
    bscRpcUrlSecondary,
    usdtContractAddress,
    moralisApiKey,
    moralisWebhookSecret,
    marketDataApiKey,
    withdrawalsEnabled,
    signerSecretReference,
    masterDerivationSecretReference,
  };
}
