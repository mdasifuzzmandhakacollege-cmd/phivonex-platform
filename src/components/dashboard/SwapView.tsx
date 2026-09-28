import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeftRight,
  Coins,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  ArrowRight,
  Lock,
  Sparkles,
  Zap,
  ExternalLink,
  ChevronRight,
  Wallet
} from 'lucide-react';
import { UserProfile } from '../../context/AuthContext';
import { PHIVONEX_TOKEN_CONFIG } from '../../server/config/tokenConfig';
import { PhivoCoinIcon, UsdtIcon } from '../brand/CryptoIcons';
import { useSystemConfig } from '../../context/SystemConfigContext';
import { TokenPriceTrendChart } from './TokenPriceTrendChart';

interface SwapViewProps {
  user: UserProfile;
  onNavigateTab?: (tab: string) => void;
}

export interface SwapHistoryItem {
  id: string;
  publicSwapId: string;
  userId: string;
  coinAmount: number;
  rateUsdt: number;
  usdtAmount: number;
  status: 'PENDING' | 'COMPLETED' | 'REVERSED';
  rateVersion: number;
  idempotencyKey: string | null;
  createdAt: string;
  completedAt: string | null;
  direction?: 'COIN_TO_USDT' | 'USDT_TO_COIN';
}

export interface SwapQuoteData {
  coinAmount: number;
  rate: number;
  usdtAmount: number;
  rateVersion: number;
  swapEnabled: boolean;
  coinSymbol: string;
  effectiveFrom: string;
}

export const SwapView: React.FC<SwapViewProps> = ({ user, onNavigateTab }) => {
  const { coinPriceUsdt } = useSystemConfig();
  // Mode: 'COIN_TO_USDT' (Sell PHIVO, Receive USDT) vs 'USDT_TO_COIN' (Spend USDT, Buy PHIVO)
  const [swapDirection, setSwapDirection] = useState<'COIN_TO_USDT' | 'USDT_TO_COIN'>('COIN_TO_USDT');

  // Balances
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [usdtBalance, setUsdtBalance] = useState<number>(0);
  const [totalEarnedCoins, setTotalEarnedCoins] = useState<number>(0);
  const [totalSwappedCoins, setTotalSwappedCoins] = useState<number>(0);

  const [quote, setQuote] = useState<SwapQuoteData | null>(null);
  const [history, setHistory] = useState<SwapHistoryItem[]>([]);
  const [historySummary, setHistorySummary] = useState({
    totalSwappedCoins: 0,
    totalUsdtReceived: 0,
    totalSwapsCount: 0,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [swapAmountInput, setSwapAmountInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirmation Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Fetch Balances and Live Rate
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [balRes, quoteRes, histRes, walletRes] = await Promise.all([
        fetch('/api/swap/balance', { credentials: 'include' }),
        fetch('/api/swap/quote?amount=1'),
        fetch('/api/swap/history?limit=30', { credentials: 'include' }),
        fetch('/api/wallet/me', { credentials: 'include' }),
      ]);

      if (balRes.ok) {
        const balData = await balRes.json();
        setCoinBalance(balData.availableCoinBalance ?? 0);
        setTotalEarnedCoins(balData.totalEarnedCoins ?? 0);
        setTotalSwappedCoins(balData.totalSwappedCoins ?? 0);
      }

      if (walletRes.ok) {
        const wData = await walletRes.json();
        setUsdtBalance(Number(wData.availableBalance || 0));
      }

      if (quoteRes.ok) {
        const quoteData = await quoteRes.json();
        setQuote(quoteData);
      }

      if (histRes.ok) {
        const histData = await histRes.json();
        setHistory(histData.swaps || []);
        if (histData.summary) {
          setHistorySummary(histData.summary);
        }
      }
    } catch (err) {
      console.error('[SwapView] Error fetching swap data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Active conversion rate (e.g. 1 PHIVO = $0.10 USDT)
  const activeRate = quote?.rate || coinPriceUsdt || 0.10;
  const isSwapDisabled = quote?.swapEnabled === false;

  // Handle Quick Percent Selection
  const handleQuickPercent = (pct: number) => {
    const maxVal = swapDirection === 'COIN_TO_USDT' ? coinBalance : usdtBalance;
    if (maxVal <= 0) return;
    const computed = (maxVal * (pct / 100)).toFixed(swapDirection === 'COIN_TO_USDT' ? 4 : 2);
    setSwapAmountInput(computed);
    setFeedback(null);
  };

  // Toggle direction
  const handleToggleDirection = () => {
    setSwapDirection(prev => prev === 'COIN_TO_USDT' ? 'USDT_TO_COIN' : 'COIN_TO_USDT');
    setSwapAmountInput('');
    setFeedback(null);
  };

  // Numerical calculations based on direction
  const parsedInput = parseFloat(swapAmountInput) || 0;

  // If COIN_TO_USDT: Input is PHIVO, Output is USDT
  // If USDT_TO_COIN: Input is USDT, Output is PHIVO
  const isCoinToUsdt = swapDirection === 'COIN_TO_USDT';
  const availableSourceBalance = isCoinToUsdt ? coinBalance : usdtBalance;
  const isInsufficient = parsedInput > availableSourceBalance;
  
  const estimatedOutput = isCoinToUsdt
    ? Number((parsedInput * activeRate).toFixed(4))
    : Number((activeRate > 0 ? parsedInput / activeRate : 0).toFixed(4));

  const isValidAmount = parsedInput > 0 && !isInsufficient && !isSwapDisabled;

  // Open Confirmation Modal
  const handleInitiateSwap = () => {
    setFeedback(null);
    if (!isValidAmount) return;
    setIsConfirmModalOpen(true);
  };

  // Execute Swap Action
  const handleConfirmExecute = async () => {
    try {
      setSubmitting(true);
      setFeedback(null);

      const endpoint = isCoinToUsdt ? '/api/swap/coin-to-usdt' : '/api/swap/usdt-to-coin';
      const body = isCoinToUsdt
        ? { coinAmount: parsedInput, idempotencyKey: `swap-c2u-${user.id.slice(0, 8)}-${Date.now()}` }
        : { usdtAmount: parsedInput, idempotencyKey: `swap-u2c-${user.id.slice(0, 8)}-${Date.now()}` };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: 'error',
          message: data.message || 'Failed to execute internal swap.',
        });
        setIsConfirmModalOpen(false);
        return;
      }

      setFeedback({
        type: 'success',
        message: isCoinToUsdt
          ? `Successfully converted ${parsedInput} PHIVO into $${data.swap?.usdtAmount?.toFixed(2)} USDT ledger balance!`
          : `Successfully converted $${parsedInput} USDT into ${data.swap?.coinAmount ? Math.abs(data.swap.coinAmount).toFixed(4) : estimatedOutput.toFixed(4)} PHIVO coins!`,
      });

      setSwapAmountInput('');
      setIsConfirmModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('[SwapView] Execute swap error:', err);
      setFeedback({
        type: 'error',
        message: 'Network error executing swap. Please retry.',
      });
      setIsConfirmModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#00CFFF] uppercase tracking-wider">
            <Coins className="w-3.5 h-3.5" />
            <span>PHIVONEX Liquidity &amp; Conversion Layer</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1 flex items-center gap-3">
            Bidirectional Coin &amp; Dollar Swap
          </h1>
          <p className="text-sm text-[#98A2B3] mt-1 max-w-2xl">
            Seamlessly convert earned PHIVO mining coins into USDT balance for withdrawal, or convert USDT balance into PHIVO coins to accumulate and hold.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-white font-mono transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#00CFFF]' : ''}`} />
            <span>Sync Balances</span>
          </button>
        </div>
      </div>

      {/* 2. FEEDBACK BANNER */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-[#12B76A]/10 border-[#12B76A]/30 text-[#12B76A]'
              : 'bg-[#F04438]/10 border-[#F04438]/30 text-[#F04438]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs underline hover:opacity-80 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 3. METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Available Coin Balance */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] relative overflow-hidden group hover:border-[#00CFFF]/40 transition-colors">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs">
            <span>Available PHIVO Coin</span>
            <div className="p-2 rounded-lg bg-[#00CFFF]/10 text-[#00CFFF]">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {coinBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} PHIVO
            </div>
            <div className="text-[11px] text-[#98A2B3] mt-0.5 flex items-center gap-1.5">
              <span>≈ ${(coinBalance * activeRate).toFixed(2)} USDT value</span>
            </div>
          </div>
        </div>

        {/* Card 2: Available USDT Balance */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] relative overflow-hidden group hover:border-[#12B76A]/40 transition-colors">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs">
            <span>Available USDT Balance</span>
            <div className="p-2 rounded-lg bg-[#12B76A]/10 text-[#12B76A]">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#12B76A] tracking-tight">
              ${usdtBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
            </div>
            <div className="text-[11px] text-[#98A2B3] mt-0.5 flex items-center gap-1.5">
              <span>Eligible for Node &amp; Withdrawals</span>
            </div>
          </div>
        </div>

        {/* Card 3: Active Coin Price */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] relative overflow-hidden group hover:border-purple-400/40 transition-colors">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs">
            <span>Conversion Rate</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              1 PHIVO = ${activeRate.toFixed(2)}
            </div>
            <div className="text-[11px] text-[#98A2B3] mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
              <span>Version {quote?.rateVersion || 1} • Authoritative</span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Swaps Count */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] relative overflow-hidden group hover:border-amber-400/40 transition-colors">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs">
            <span>Total Swaps Settled</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {historySummary.totalSwapsCount} Operations
            </div>
            <div className="text-[11px] text-[#98A2B3] mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#12B76A]" />
              <span>Instant Ledger Settlement</span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time 24H Price Trend Chart */}
      <TokenPriceTrendChart />

      {/* 4. SWAP INTERFACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Swap Card (7 Cols) */}
        <div className="lg:col-span-7 bg-[#07101D] border border-white/[0.08] rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-6">
            {/* Direction Selector Tabs */}
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-[#05070B] border border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setSwapDirection('COIN_TO_USDT');
                  setSwapAmountInput('');
                  setFeedback(null);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all ${
                  isCoinToUsdt
                    ? 'bg-gradient-to-r from-[#00CFFF]/20 to-[#168BFF]/20 text-white border border-[#00CFFF]/40 shadow-sm'
                    : 'text-[#98A2B3] hover:text-white'
                }`}
              >
                <PhivoCoinIcon size={16} />
                <span>PHIVO → USDT (Sell Coin)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSwapDirection('USDT_TO_COIN');
                  setSwapAmountInput('');
                  setFeedback(null);
                }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all ${
                  !isCoinToUsdt
                    ? 'bg-gradient-to-r from-[#12B76A]/20 to-emerald-600/20 text-white border border-[#12B76A]/40 shadow-sm'
                    : 'text-[#98A2B3] hover:text-white'
                }`}
              >
                <UsdtIcon size={16} />
                <span>USDT → PHIVO (Buy Coin)</span>
              </button>
            </div>

            {/* Input Box (Pay) */}
            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#98A2B3] font-mono uppercase tracking-wider text-[10px]">
                  You Pay ({isCoinToUsdt ? 'PHIVO' : 'USDT'})
                </span>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#98A2B3]">Available:</span>
                  <span className="text-[#00CFFF] font-bold">
                    {isCoinToUsdt ? `${coinBalance.toFixed(4)} PHIVO` : `$${usdtBalance.toFixed(2)} USDT`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={swapAmountInput}
                  onChange={(e) => {
                    setSwapAmountInput(e.target.value);
                    setFeedback(null);
                  }}
                  disabled={submitting || quote?.swapEnabled === false}
                  className="w-full bg-transparent text-2xl sm:text-3xl font-mono font-bold text-white placeholder:text-white/20 focus:outline-none"
                />

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] shrink-0">
                  {isCoinToUsdt ? <PhivoCoinIcon size={22} /> : <UsdtIcon size={22} />}
                  <span className="text-sm font-bold font-mono text-white">
                    {isCoinToUsdt ? 'PHIVO' : 'USDT'}
                  </span>
                </div>
              </div>

              {/* Quick Percent Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleQuickPercent(pct)}
                    disabled={availableSourceBalance <= 0 || quote?.swapEnabled === false}
                    className="flex-1 py-1 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] font-mono text-[#98A2B3] hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                  >
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Direction Switch Toggle Button */}
            <div className="flex justify-center -my-3 relative z-10">
              <button
                type="button"
                onClick={handleToggleDirection}
                className="w-9 h-9 rounded-full bg-[#07101D] border border-white/[0.12] hover:border-[#00CFFF] shadow-lg flex items-center justify-center text-[#00CFFF] hover:scale-110 transition-transform cursor-pointer"
                title="Switch Swap Direction"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </button>
            </div>

            {/* Output Box (Receive) */}
            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#98A2B3] font-mono uppercase tracking-wider text-[10px]">
                  You Receive ({isCoinToUsdt ? 'USDT' : 'PHIVO'})
                </span>
                <span className="text-[10px] font-mono text-[#12B76A] bg-[#12B76A]/10 px-2 py-0.5 rounded">
                  Rate: 1 PHIVO = ${activeRate.toFixed(2)} USDT
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="text-2xl sm:text-3xl font-mono font-bold text-[#12B76A]">
                  {isCoinToUsdt ? `$${estimatedOutput.toFixed(2)}` : `${estimatedOutput.toFixed(4)} PHIVO`}
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#12B76A]/10 border border-[#12B76A]/30 shrink-0">
                  {isCoinToUsdt ? <UsdtIcon size={22} /> : <PhivoCoinIcon size={22} />}
                  <span className="text-sm font-bold font-mono text-[#12B76A]">
                    {isCoinToUsdt ? 'USDT' : 'PHIVO'}
                  </span>
                </div>
              </div>
            </div>

            {/* Validation Notice */}
            {isInsufficient && parsedInput > 0 && (
              <div className="p-3 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-center gap-2 text-xs text-[#F04438]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Requested swap exceeds available {isCoinToUsdt ? 'PHIVO' : 'USDT'} balance ({availableSourceBalance.toFixed(isCoinToUsdt ? 4 : 2)}).
                </span>
              </div>
            )}

            {isSwapDisabled && (
              <div className="p-3 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-center gap-2 text-xs text-[#F04438]">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Internal swapping is currently disabled by PHIVONEX administration.</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-6">
            <button
              onClick={handleInitiateSwap}
              disabled={!isValidAmount || submitting}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none min-h-[48px] ${
                isCoinToUsdt
                  ? 'bg-gradient-to-r from-[#00CFFF] to-[#00A3FF] text-[#05070B] shadow-[#00CFFF]/20'
                  : 'bg-gradient-to-r from-[#12B76A] to-emerald-500 text-white shadow-emerald-500/20'
              }`}
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>
                {isSwapDisabled
                  ? 'Swapping Disabled'
                  : isInsufficient
                  ? `Insufficient ${isCoinToUsdt ? 'PHIVO' : 'USDT'} Balance`
                  : parsedInput <= 0
                  ? 'Enter Amount to Swap'
                  : isCoinToUsdt
                  ? `Convert ${parsedInput} PHIVO → $${estimatedOutput.toFixed(2)} USDT`
                  : `Convert $${parsedInput} USDT → ${estimatedOutput.toFixed(4)} PHIVO`}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Specifications & Protocol Guarantee (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#07101D] border border-white/[0.08] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-[#00CFFF] uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Swap Protocol Guarantee</span>
            </div>

            <h3 className="text-base font-bold text-white">
              Instant Atomic Internal Liquidity
            </h3>

            <ul className="space-y-3 text-xs text-[#98A2B3]">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#12B76A] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Full Bi-Directional Swaps:</strong> Convert mining coin rewards into USDT for withdrawal, or convert internal USDT into PHIVO coins to hold in your wallet.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#12B76A] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Unused Deposit Withdrawal:</strong> Users who deposit USDT can withdraw funds freely without any lock-in if they choose not to activate nodes.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#12B76A] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Real-Time Ledger Settlement:</strong> Transactions are atomic, double-entry balanced, and permanently logged in Firestore &amp; PostgreSQL.
                </span>
              </li>
            </ul>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-[11px] font-mono">
              <div className="flex items-center justify-between text-[#98A2B3]">
                <span>Token Contract:</span>
                <span className="text-[#00CFFF]">BEP-20 (BSC)</span>
              </div>
              <div className="text-[10px] text-white/70 break-all select-all font-mono bg-black/40 p-2 rounded border border-white/[0.04]">
                {PHIVONEX_TOKEN_CONFIG.contractAddress}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. SWAP HISTORY TABLE */}
      <div className="bg-[#07101D] border border-white/[0.08] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#00CFFF]" />
              <span>Conversion &amp; Swap History</span>
            </h2>
            <p className="text-xs text-[#98A2B3] mt-0.5">
              Auditable log of all completed coin-to-USDT and USDT-to-coin conversion transactions.
            </p>
          </div>
          <span className="text-xs font-mono text-[#98A2B3]">
            Showing {history.length} record(s)
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-[#05070B] border border-white/[0.04] space-y-3">
            <Coins className="w-8 h-8 text-[#98A2B3] mx-auto opacity-40" />
            <div className="text-sm font-bold text-white">No Swap Records Yet</div>
            <p className="text-xs text-[#98A2B3] max-w-sm mx-auto">
              You haven't converted any assets yet. Use the engine above to swap coins or USDT.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#05070B] text-[#98A2B3] font-mono uppercase text-[10px] border-b border-white/[0.06]">
                <tr>
                  <th className="py-3 px-4">Date &amp; Time</th>
                  <th className="py-3 px-4">Swap ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Coin Amount</th>
                  <th className="py-3 px-4">Rate Applied</th>
                  <th className="py-3 px-4">USDT Amount</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-mono">
                {history.map((item) => {
                  const isBuy = item.direction === 'USDT_TO_COIN';
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-[#98A2B3]">
                        {new Date(item.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-bold text-white">
                        {item.publicSwapId}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isBuy
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          }`}
                        >
                          {isBuy ? 'USDT → PHIVO' : 'PHIVO → USDT'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#00CFFF]">
                        {isBuy ? `+${Math.abs(item.coinAmount).toFixed(4)}` : `-${Math.abs(item.coinAmount).toFixed(4)}`} PHIVO
                      </td>
                      <td className="py-3 px-4 text-white">
                        ${item.rateUsdt.toFixed(2)} / PHIVO
                      </td>
                      <td className={`py-3 px-4 font-bold ${isBuy ? 'text-[#F04438]' : 'text-[#12B76A]'}`}>
                        {isBuy ? `-$${item.usdtAmount.toFixed(2)}` : `+$${item.usdtAmount.toFixed(2)}`} USDT
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#12B76A]/10 text-[#12B76A] border border-[#12B76A]/30">
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 6. CONFIRMATION MODAL */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#07101D] border border-white/[0.12] rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00CFFF]/10 border border-[#00CFFF]/30 flex items-center justify-center text-[#00CFFF]">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Confirm {isCoinToUsdt ? 'PHIVO → USDT' : 'USDT → PHIVO'} Swap
                </h3>
                <p className="text-xs text-[#98A2B3]">Permanent ledger conversion operation</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.08] space-y-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#98A2B3]">You Pay:</span>
                <span className="text-white font-bold">
                  {isCoinToUsdt ? `${parsedInput} PHIVO` : `$${parsedInput.toFixed(2)} USDT`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#98A2B3]">Applied Rate:</span>
                <span className="text-[#12B76A] font-bold">${activeRate.toFixed(2)} USDT / PHIVO</span>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex justify-between text-sm">
                <span className="text-white font-bold">You Receive:</span>
                <span className="text-[#12B76A] font-bold">
                  {isCoinToUsdt ? `$${estimatedOutput.toFixed(2)} USDT` : `${estimatedOutput.toFixed(4)} PHIVO`}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#98A2B3] leading-relaxed">
              Upon confirmation, your {isCoinToUsdt ? 'PHIVO coin' : 'USDT ledger'} balance will be debited and the resulting {isCoinToUsdt ? 'USDT funds' : 'PHIVO coins'} will be credited immediately to your account.
            </p>



            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExecute}
                disabled={submitting}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#00CFFF] to-[#00A3FF] text-[#05070B] text-xs font-bold flex items-center justify-center gap-2 transition-opacity cursor-pointer disabled:opacity-50 shadow-lg shadow-[#00CFFF]/20"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>Confirm &amp; Convert</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
