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
  ChevronRight
} from 'lucide-react';
import { UserProfile } from '../../context/AuthContext';
import { PHIVONEX_TOKEN_CONFIG } from '../../server/config/tokenConfig';
import { PhivoCoinIcon, UsdtIcon } from '../brand/CryptoIcons';

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
  // State
  const [coinBalance, setCoinBalance] = useState<number>(0);
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
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [swapAmountInput, setSwapAmountInput] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Confirmation Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);

  // Fetch Balances and Live Rate
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [balRes, quoteRes, histRes] = await Promise.all([
        fetch('/api/swap/balance'),
        fetch('/api/swap/quote?amount=1'),
        fetch('/api/swap/history?limit=30'),
      ]);

      if (balRes.ok) {
        const balData = await balRes.json();
        setCoinBalance(balData.availableCoinBalance ?? 0);
        setTotalEarnedCoins(balData.totalEarnedCoins ?? 0);
        setTotalSwappedCoins(balData.totalSwappedCoins ?? 0);
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

  // Handle Quick Percent Selection
  const handleQuickPercent = (pct: number) => {
    if (coinBalance <= 0) return;
    const computed = (coinBalance * (pct / 100)).toFixed(4);
    setSwapAmountInput(computed);
    setFeedback(null);
  };

  // Numerical calculations
  const parsedSwapAmount = parseFloat(swapAmountInput) || 0;
  const activeRate = quote?.rate || 0.10;
  const estimatedUsdt = Number((parsedSwapAmount * activeRate).toFixed(4));
  const isSwapDisabled = quote?.swapEnabled === false;
  const isInsufficient = parsedSwapAmount > coinBalance;
  const isValidAmount = parsedSwapAmount > 0 && !isInsufficient && !isSwapDisabled;

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

      const res = await fetch('/api/swap/coin-to-usdt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coinAmount: parsedSwapAmount,
          idempotencyKey: `swap-${user.id.slice(0, 8)}-${Date.now()}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: 'error',
          message: data.message || 'Failed to execute internal coin swap.',
        });
        setIsConfirmModalOpen(false);
        return;
      }

      setFeedback({
        type: 'success',
        message: `Successfully converted ${parsedSwapAmount} PHIVO into $${data.swap?.usdtAmount?.toFixed(2)} USDT ledger balance!`,
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
            <span>PHIVONEX Liquidity Layer • Task #19.1</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1 flex items-center gap-3">
            PHIVO → USDT Swap Engine
          </h1>
          <p className="text-sm text-[#98A2B3] mt-1 max-w-2xl">
            Convert earned PHIVO mining reward coins directly into internal USDT balance using the authoritative server-configured conversion rate.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-white font-mono transition-colors cursor-pointer disabled:opacity-50"
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
            <span>Available PHIVO Balance</span>
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

        {/* Card 2: Active Coin Price */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] relative overflow-hidden group hover:border-[#12B76A]/40 transition-colors">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs">
            <span>Authoritative PHIVO Price</span>
            <div className="p-2 rounded-lg bg-[#12B76A]/10 text-[#12B76A]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-[#12B76A] tracking-tight">
              ${activeRate.toFixed(2)} USDT
            </div>
            <div className="text-[11px] text-[#98A2B3] mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
              <span>Rate v{quote?.rateVersion || 1} • Server Verified</span>
            </div>
          </div>
        </div>

        {/* Card 3: Total Swapped */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] relative overflow-hidden group hover:border-purple-400/40 transition-colors">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs">
            <span>Total PHIVO Swapped</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {historySummary.totalSwappedCoins.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PHIVO
            </div>
            <div className="text-[11px] text-[#98A2B3] mt-0.5">
              <span>Across {historySummary.totalSwapsCount} swap operation(s)</span>
            </div>
          </div>
        </div>

        {/* Card 4: USDT Proceeds Realized */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] relative overflow-hidden group hover:border-amber-400/40 transition-colors">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs">
            <span>USDT Ledger Proceeds</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              ${historySummary.totalUsdtReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-[#98A2B3] mt-0.5 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#12B76A]" />
              <span>Available for Withdrawal / Nodes</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SWAP INTERFACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Swap Card (7 Cols) */}
        <div className="lg:col-span-7 bg-[#07101D] border border-white/[0.08] rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#00CFFF]" />
                  <span>Execute Coin Conversion</span>
                </h2>
                <p className="text-xs text-[#98A2B3] mt-0.5">
                  Debits PHIVO reward coins and atomically credits internal USDT balance.
                </p>
              </div>

              {quote?.swapEnabled === false ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#F04438]/10 text-[#F04438] border border-[#F04438]/30">
                  SWAP DISABLED
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#12B76A]/10 text-[#12B76A] border border-[#12B76A]/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A] animate-pulse" />
                  <span>SWAP ACTIVE</span>
                </span>
              )}
            </div>

            {/* From: PHIVONEX Coin Input */}
            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#98A2B3] font-mono uppercase tracking-wider text-[10px]">
                  You Swap (From)
                </span>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-[#98A2B3]">Available:</span>
                  <span className="text-[#00CFFF] font-bold">
                    {coinBalance.toFixed(4)} PHIVO
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
                  <PhivoCoinIcon size={22} />
                  <span className="text-sm font-bold font-mono text-white">PHIVO</span>
                </div>
              </div>

              {/* Quick Percent Buttons */}
              <div className="flex items-center gap-2 pt-1 border-t border-white/[0.04]">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleQuickPercent(pct)}
                    disabled={coinBalance <= 0 || quote?.swapEnabled === false}
                    className="flex-1 py-1 px-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] font-mono text-[#98A2B3] hover:text-white transition-colors cursor-pointer disabled:opacity-30"
                  >
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider Icon */}
            <div className="flex justify-center -my-3 relative z-10">
              <div className="w-9 h-9 rounded-full bg-[#07101D] border border-white/[0.12] shadow-lg flex items-center justify-center text-[#00CFFF]">
                <ArrowLeftRight className="w-4 h-4" />
              </div>
            </div>

            {/* To: USDT Estimated Output */}
            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.08] space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#98A2B3] font-mono uppercase tracking-wider text-[10px]">
                  You Receive (To Internal USDT Ledger)
                </span>
                <span className="text-[10px] font-mono text-[#12B76A] bg-[#12B76A]/10 px-2 py-0.5 rounded">
                  Rate: 1 PHIVO = ${activeRate.toFixed(2)} USDT
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="text-2xl sm:text-3xl font-mono font-bold text-[#12B76A]">
                  ${estimatedUsdt.toFixed(2)}
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#12B76A]/10 border border-[#12B76A]/30 shrink-0">
                  <UsdtIcon size={22} />
                  <span className="text-sm font-bold font-mono text-[#12B76A]">USDT</span>
                </div>
              </div>
            </div>

            {/* Validation Notice */}
            {isInsufficient && parsedSwapAmount > 0 && (
              <div className="p-3 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-center gap-2 text-xs text-[#F04438]">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Requested swap exceeds available PHIVO coin balance ({coinBalance.toFixed(4)} PHIVO).</span>
              </div>
            )}

            {isSwapDisabled && (
              <div className="p-3 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-center gap-2 text-xs text-[#F04438]">
                <Lock className="w-4 h-4 shrink-0" />
                <span>Internal coin swapping is currently disabled by PHIVONEX administration.</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-6">
            <button
              onClick={handleInitiateSwap}
              disabled={!isValidAmount || submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#00CFFF] to-[#00A3FF] hover:from-[#00CFFF]/90 hover:to-[#00A3FF]/90 text-[#05070B] font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#00CFFF]/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none min-h-[48px]"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>
                {isSwapDisabled
                  ? 'Swapping Disabled'
                  : isInsufficient
                  ? 'Insufficient PHIVO Balance'
                  : parsedSwapAmount <= 0
                  ? 'Enter Amount to Swap'
                  : `Convert ${parsedSwapAmount} PHIVO → $${estimatedUsdt.toFixed(2)} USDT`}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Contract & Protocol Integrity Info (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#07101D] border border-white/[0.08] rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-[#00CFFF] uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Swap Engine Specifications</span>
            </div>

            <h3 className="text-base font-bold text-white">
              Instant Atomic Internal Liquidity
            </h3>

            <ul className="space-y-3 text-xs text-[#98A2B3]">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#12B76A] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Server-Authoritative Pricing:</strong> Swaps execute strictly against the active Admin economic rate with immutable historical versioning.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#12B76A] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Direct USDT Ledger Credit:</strong> USDT proceeds immediately post as internal balance for Genesis Node activation or USDT TRC20/BEP20 withdrawals.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#12B76A] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Permanent Rate Guarantee:</strong> Historical swap records permanently preserve the exact rate used and never recompute upon future rate updates.
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
              <span>Conversion & Swap History</span>
            </h2>
            <p className="text-xs text-[#98A2B3] mt-0.5">
              Auditable log of all completed coin-to-USDT conversion transactions.
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
              You haven't converted any PHIVONEX coins yet. Use the engine above to swap earned mining rewards to internal USDT.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#05070B] text-[#98A2B3] font-mono uppercase text-[10px] border-b border-white/[0.06]">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Swap ID</th>
                  <th className="py-3 px-4">Coins Debited</th>
                  <th className="py-3 px-4">Rate Applied</th>
                  <th className="py-3 px-4">USDT Credited</th>
                  <th className="py-3 px-4">Rate Version</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] font-mono">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-[#98A2B3]">
                      {new Date(item.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">
                      {item.publicSwapId}
                    </td>
                    <td className="py-3 px-4 text-[#00CFFF]">
                      -{item.coinAmount.toFixed(4)} PHIVO
                    </td>
                    <td className="py-3 px-4 text-white">
                      ${item.rateUsdt.toFixed(2)} / PHIVO
                    </td>
                    <td className="py-3 px-4 text-[#12B76A] font-bold">
                      +${item.usdtAmount.toFixed(2)} USDT
                    </td>
                    <td className="py-3 px-4 text-[#98A2B3]">
                      v{item.rateVersion}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#12B76A]/10 text-[#12B76A] border border-[#12B76A]/30">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
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
                <h3 className="text-lg font-bold text-white">Confirm Internal Coin Swap</h3>
                <p className="text-xs text-[#98A2B3]">Permanent ledger conversion operation</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.08] space-y-3 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-[#98A2B3]">Coin Amount to Debit:</span>
                <span className="text-white font-bold">{parsedSwapAmount} PHIVO</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#98A2B3]">Applied Conversion Rate:</span>
                <span className="text-[#12B76A] font-bold">${activeRate.toFixed(2)} USDT / PHIVO</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#98A2B3]">Rate Version:</span>
                <span className="text-white">v{quote?.rateVersion || 1}</span>
              </div>
              <div className="pt-2 border-t border-white/[0.06] flex justify-between text-sm">
                <span className="text-white font-bold">Total USDT Proceeds:</span>
                <span className="text-[#12B76A] font-bold">${estimatedUsdt.toFixed(2)} USDT</span>
              </div>
            </div>

            <p className="text-[11px] text-[#98A2B3] leading-relaxed">
              Upon confirmation, your PHIVO coin balance will be debited and the resulting USDT funds will be immediately credited to your internal financial ledger balance.
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
                    <span>Confirm & Convert</span>
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
