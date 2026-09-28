import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowUpRight,
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  ShieldCheck,
  Building2,
  QrCode,
  Send,
  Loader2,
  Info,
  ExternalLink,
  Ban,
  Check
} from 'lucide-react';
import { UserProfile } from '../../context/AuthContext';
import { SecurityCaptcha } from '../common/SecurityCaptcha';
import { useSystemConfig } from '../../context/SystemConfigContext';

interface WithdrawalsViewProps {
  user: UserProfile;
  onNavigateTab?: (tab: string) => void;
}

export interface WithdrawalItem {
  id: string;
  publicWithdrawalId: string;
  userId: string;
  amount: number;
  currency: string;
  destinationType: string;
  destinationReference: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  failedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export const WithdrawalsView: React.FC<WithdrawalsViewProps> = ({ user, onNavigateTab }) => {
  const { minWithdrawalAmount: realTimeMinAmount } = useSystemConfig();
  const [availableBalance, setAvailableBalance] = useState<number>(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState<number>(0);
  const [pendingTotal, setPendingTotal] = useState<number>(0);
  const [minWithdrawalAmount, setMinWithdrawalAmount] = useState<number>(realTimeMinAmount || 0.10);

  useEffect(() => {
    if (typeof realTimeMinAmount === 'number' && realTimeMinAmount >= 0) {
      setMinWithdrawalAmount(realTimeMinAmount);
    }
  }, [realTimeMinAmount]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Form states - BNB Smart Chain BEP-20 as primary default
  const [amountInput, setAmountInput] = useState<string>('');
  const [destinationType, setDestinationType] = useState<string>('USDT_BEP20');
  const [destinationRef, setDestinationRef] = useState<string>('');
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Detail Modal
  const [selectedItem, setSelectedItem] = useState<WithdrawalItem | null>(null);

  // Fetch Wallet Balance & Withdrawal History & Config
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [walletRes, historyRes, configRes] = await Promise.all([
        fetch('/api/wallet/me', { credentials: 'include' }).catch(() => null),
        fetch('/api/withdrawals/me?limit=50').catch(() => null),
        fetch('/api/withdrawals/config').catch(() => null),
      ]);

      if (walletRes && walletRes.ok) {
        const walletData = await walletRes.json();
        setAvailableBalance(walletData.availableBalance ?? walletData.ledgerBalance ?? 0);
        setTotalWithdrawn(walletData.totalWithdrawn ?? 0);
      }

      if (configRes && configRes.ok) {
        const configData = await configRes.json();
        if (typeof configData.minWithdrawalAmount === 'number') {
          setMinWithdrawalAmount(configData.minWithdrawalAmount);
        }
      }

      if (historyRes && historyRes.ok) {
        const historyData = await historyRes.json();
        if (Array.isArray(historyData.withdrawals)) {
          setWithdrawals(historyData.withdrawals);

          // Compute pending total
          const pendingSum = historyData.withdrawals
            .filter((w: WithdrawalItem) => w.status === 'PENDING' || w.status === 'APPROVED' || w.status === 'PROCESSING')
            .reduce((acc: number, w: WithdrawalItem) => acc + (w.amount || 0), 0);
          setPendingTotal(pendingSum);
        }
      }
    } catch (err) {
      console.error('[WithdrawalsView] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Form Submission
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const numAmount = parseFloat(amountInput);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Please enter a valid positive withdrawal amount.');
      return;
    }

    if (numAmount < minWithdrawalAmount) {
      setFormError(`Minimum withdrawal amount is $${minWithdrawalAmount.toFixed(2)} USD (${minWithdrawalAmount} USDT).`);
      return;
    }

    if (numAmount > availableBalance) {
      setFormError(`Insufficient balance. Available eligible balance is $${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD.`);
      return;
    }

    const trimmedRef = destinationRef.trim();
    if (!trimmedRef) {
      setFormError('Please provide your payout wallet address or bank account destination.');
      return;
    }

    // EVM Address validation for BEP-20 & ERC-20
    if (destinationType === 'USDT_BEP20' || destinationType === 'BNB' || destinationType === 'USDT_ERC20') {
      const evmRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!evmRegex.test(trimmedRef)) {
        setFormError('Invalid wallet address format. BNB Smart Chain (BEP-20) addresses must start with "0x" and be 42 characters long.');
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          destinationType,
          destinationReference: trimmedRef,
          captchaToken: captchaToken || undefined,
          idempotencyKey: `wdr-ui-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.message || 'Failed to submit withdrawal request.');
        return;
      }

      setFormSuccess(`Withdrawal request ${data.publicWithdrawalId || ''} for $${numAmount.toFixed(2)} USD submitted successfully via ${formatDestinationLabel(destinationType)}!`);
      setAmountInput('');
      setDestinationRef('');
      await fetchData();
    } catch (err: any) {
      setFormError(err?.message || 'Network error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle User Cancellation
  const handleCancelRequest = async (publicWithdrawalId: string) => {
    try {
      setCancellingId(publicWithdrawalId);
      setFormError(null);
      const res = await fetch(`/api/withdrawals/${publicWithdrawalId}/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        setFormError(data.message || 'Failed to cancel withdrawal.');
        return;
      }

      setFormSuccess(`Withdrawal ${publicWithdrawalId} cancelled successfully. Funds returned to balance.`);
      await fetchData();
    } catch (err) {
      console.error('[WithdrawalsView] Cancel error:', err);
      setFormError('Failed to cancel withdrawal due to network error.');
    } finally {
      setCancellingId(null);
    }
  };

  // Filtered list
  const filteredWithdrawals = withdrawals.filter((item) => {
    if (statusFilter !== 'ALL' && item.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        item.publicWithdrawalId.toLowerCase().includes(q) ||
        item.destinationReference.toLowerCase().includes(q) ||
        item.destinationType.toLowerCase().includes(q) ||
        item.amount.toString().includes(q)
      );
    }
    return true;
  });

  const formatDestinationLabel = (type: string) => {
    switch (type) {
      case 'USDT_BEP20':
      case 'BEP20':
        return 'USDT (BEP-20) [BNB Chain]';
      case 'BNB':
        return 'BNB (BEP-20) [BNB Smart Chain]';
      case 'USDT_ERC20':
        return 'USDT (ERC-20)';
      case 'BTC':
        return 'Bitcoin (BTC)';
      case 'ETH':
        return 'Ethereum (ETH)';
      case 'BANK_WIRE':
        return 'Bank Wire / SWIFT';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: WithdrawalItem['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#FFB020]/10 text-[#FFB020] border border-[#FFB020]/20">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            Pending Review
          </span>
        );
      case 'APPROVED':
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#168BFF]/10 text-[#00CFFF] border border-[#168BFF]/20">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Settlement Processing
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#32D583]/10 text-[#32D583] border border-[#32D583]/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F04438]/10 text-[#F04438] border border-[#F04438]/20">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#F04438]/10 text-[#F04438] border border-[#F04438]/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Transfer Failed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/[0.06] text-[#98A2B3] border border-white/[0.1]">
            <Ban className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-[#07101D] via-[#091527] to-[#0B1A30] border border-white/[0.08] shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#F0B90B]/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20 text-[11px] font-mono font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              BNB Smart Chain Settlement Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Withdrawal &amp; Settlement Portal
          </h1>
          <p className="text-xs text-[#98A2B3] max-w-xl">
            Request funds directly from your verified ledger earnings. Fast, low-gas disbursements are prioritized on BNB Smart Chain (BEP-20).
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="self-start md:self-center px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.1] text-xs font-medium flex items-center gap-2 transition-all cursor-pointer min-h-[40px]"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#F0B90B] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Available Ledger Balance */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-[#F0B90B]/30 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#F0B90B]/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between text-[#98A2B3] text-xs font-medium mb-2">
            <span className="flex items-center gap-1.5 text-white">
              <Wallet className="w-4 h-4 text-[#F0B90B]" />
              Available Ledger Balance
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F0B90B]/10 text-[#F0B90B] border border-[#F0B90B]/20">
              Eligible
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
            ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#98A2B3] mt-2">
            Net settled earnings ready for withdrawal.
          </p>
        </div>

        {/* Pending / In-Flight Reserved */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs font-medium mb-2">
            <span className="flex items-center gap-1.5 text-white">
              <Clock className="w-4 h-4 text-[#FFB020]" />
              Pending Reserved Funds
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFB020]/10 text-[#FFB020] border border-[#FFB020]/20">
              In-Flight
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
            ${pendingTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#98A2B3] mt-2">
            Reserved for pending or processing settlement requests.
          </p>
        </div>

        {/* Total Settled / Withdrawn */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs font-medium mb-2">
            <span className="flex items-center gap-1.5 text-white">
              <CheckCircle2 className="w-4 h-4 text-[#32D583]" />
              Total Disbursed / Withdrawn
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#32D583]/10 text-[#32D583] border border-[#32D583]/20">
              Settled
            </span>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
            ${totalWithdrawn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#98A2B3] mt-2">
            Lifetime completed payouts successfully transferred.
          </p>
        </div>
      </div>

      {/* Main Form & Guidelines Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Withdrawal Form */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-[#F0B90B]" />
                Request New Withdrawal
              </h2>
              <p className="text-xs text-[#98A2B3]">
                Funds are reserved from your ledger balance upon submission.
              </p>
            </div>
            <span className="text-[11px] font-mono text-[#F0B90B] bg-[#F0B90B]/10 px-2.5 py-1 rounded-md border border-[#F0B90B]/20 font-bold">
              BNB Smart Chain
            </span>
          </div>

          {formError && (
            <div className="p-4 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 text-[#F04438] text-xs flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Submission Error</span>
                <span>{formError}</span>
              </div>
            </div>
          )}

          {formSuccess && (
            <div className="p-4 rounded-xl bg-[#32D583]/10 border border-[#32D583]/30 text-[#32D583] text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Request Created</span>
                <span>{formSuccess}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitRequest} className="space-y-5">
            {/* Amount Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-white flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-[#F0B90B]" />
                  Withdrawal Amount (USD)
                </label>
                <span className="text-[#98A2B3]">
                  Available: <span className="font-mono text-white">${availableBalance.toFixed(2)}</span>
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3] font-mono font-bold text-sm">
                  $
                </div>
                <input
                  type="number"
                  step="0.01"
                  min={minWithdrawalAmount}
                  max={availableBalance > 0 ? availableBalance : 0}
                  placeholder="0.00"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full pl-8 pr-20 py-3 bg-[#05070B] border border-white/[0.12] focus:border-[#F0B90B] rounded-xl text-white font-mono font-semibold text-base outline-none transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setAmountInput(availableBalance.toFixed(2))}
                  className="absolute inset-y-1.5 right-2 px-3 bg-[#F0B90B]/10 hover:bg-[#F0B90B]/20 text-[#F0B90B] border border-[#F0B90B]/30 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer"
                >
                  MAX
                </button>
              </div>
              <p className="text-[11px] text-[#98A2B3] flex items-center justify-between">
                <span>Minimum limit: ${minWithdrawalAmount.toFixed(2)} USD ({minWithdrawalAmount} USDT)</span>
                <span className="text-[#32D583]">Ultra-low network gas fee</span>
              </p>
            </div>

            {/* Destination Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white block">
                Payout Channel / Destination Method
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {[
                  { id: 'USDT_BEP20', name: 'USDT (BEP-20)', sub: 'BNB Smart Chain (Recommended)', isPrimary: true },
                  { id: 'BNB', name: 'BNB (BEP-20)', sub: 'BNB Smart Chain Native', isPrimary: true },
                  { id: 'USDT_ERC20', name: 'USDT (ERC-20)', sub: 'Ethereum Network', isPrimary: false },
                  { id: 'BTC', name: 'Bitcoin (BTC)', sub: 'Bitcoin Mainnet', isPrimary: false },
                  { id: 'BANK_WIRE', name: 'Bank Wire', sub: 'SWIFT / ACH', isPrimary: false },
                ].map((item) => {
                  const selected = destinationType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDestinationType(item.id)}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer relative ${
                        selected
                          ? 'bg-[#F0B90B]/10 border-[#F0B90B] text-white shadow-sm shadow-[#F0B90B]/20'
                          : 'bg-[#05070B] border-white/[0.08] text-[#98A2B3] hover:text-white hover:border-white/[0.2]'
                      }`}
                    >
                      {item.isPrimary && (
                        <span className="absolute top-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#F0B90B]/20 text-[#F0B90B] border border-[#F0B90B]/30 font-bold">
                          BSC
                        </span>
                      )}
                      <div className="text-xs font-bold text-white pr-8">{item.name}</div>
                      <div className="text-[10px] text-[#98A2B3] mt-0.5">{item.sub}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Destination Reference Address */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white block">
                Destination Wallet Address / Bank Details
              </label>
              <textarea
                rows={2}
                placeholder={
                  destinationType === 'BANK_WIRE'
                    ? 'Bank Name, Account Number, SWIFT/BIC Code, Account Holder Name'
                    : destinationType === 'BTC'
                    ? 'Enter your Bitcoin wallet address (e.g., bc1... or 1...)'
                    : 'Enter your BNB Smart Chain (BEP-20) 0x... wallet address'
                }
                value={destinationRef}
                onChange={(e) => setDestinationRef(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#05070B] border border-white/[0.12] focus:border-[#F0B90B] rounded-xl text-white font-mono text-xs outline-none transition-colors resize-none"
                required
              />
              <p className="text-[11px] text-[#98A2B3]">
                {destinationType === 'USDT_BEP20' || destinationType === 'BNB' ? (
                  <span className="text-[#F0B90B]">
                    Ensure your address supports BNB Smart Chain (BEP-20) (e.g. Binance, Trust Wallet, MetaMask).
                  </span>
                ) : null}
              </p>
            </div>

            {/* Real-Time Security Verification Barrier */}
            <SecurityCaptcha
              action="withdrawal"
              label="Payout Authorization Shield"
              onVerify={(token) => setCaptchaToken(token)}
              onReset={() => setCaptchaToken('')}
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || availableBalance < minWithdrawalAmount}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#F0B90B] to-[#F5D061] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[48px] shadow-lg shadow-[#F0B90B]/20"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Reserving Funds &amp; Submitting to BNB Smart Chain...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Submit Withdrawal Request</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Column: Security Protocol Guidelines */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#32D583]" />
              BNB Smart Chain Settlement Safeguards
            </h3>
            
            <ul className="space-y-3 text-xs text-[#98A2B3]">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#F0B90B] shrink-0 mt-0.5" />
                <span><strong>Transactional Balance Reservation:</strong> Funds are locked immediately upon request to ensure zero double-spending.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#F0B90B] shrink-0 mt-0.5" />
                <span><strong>High-Speed BEP-20 Execution:</strong> BNB Smart Chain transactions confirm rapidly with minimal gas overhead.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#F0B90B] shrink-0 mt-0.5" />
                <span><strong>Automatic Release:</strong> If a request is rejected or cancelled, reserved funds are automatically restored to your available balance.</span>
              </li>
            </ul>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] text-[#98A2B3] space-y-1">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#F0B90B]" />
                Cancel Anytime
              </div>
              <p>
                You may cancel any <strong>PENDING</strong> request at any time prior to administrative review to immediately release funds back to your balance.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Withdrawal History Table */}
      <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#F0B90B]" />
              Withdrawal History &amp; Status
            </h2>
            <p className="text-xs text-[#98A2B3]">
              Real-time audit log of all requested payouts and settlements on BNB Smart Chain.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
              <input
                type="text"
                placeholder="Search ID or Destination..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[#05070B] border border-white/[0.1] rounded-lg text-xs text-white outline-none focus:border-[#F0B90B] w-48"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#05070B] border border-white/[0.1] rounded-lg text-xs text-white outline-none focus:border-[#F0B90B] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Processing</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Table List */}
        {filteredWithdrawals.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#98A2B3] space-y-2">
            <Info className="w-8 h-8 text-[#98A2B3]/50 mx-auto" />
            <p className="font-semibold text-white">No withdrawal records found</p>
            <p>Your withdrawal history will appear here once you make a request.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[#98A2B3] border-b border-white/[0.06] uppercase text-[10px] font-mono tracking-wider">
                  <th className="py-3 px-3">Public Request ID</th>
                  <th className="py-3 px-3">Channel / Destination</th>
                  <th className="py-3 px-3">Amount (USD)</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredWithdrawals.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-3 font-mono font-bold text-white">
                      {item.publicWithdrawalId}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-medium text-white">{formatDestinationLabel(item.destinationType)}</div>
                      <div className="font-mono text-[11px] text-[#98A2B3] truncate max-w-[180px]">
                        {item.destinationReference}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-[#F0B90B]">
                      ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-3">
                      {getStatusBadge(item.status)}
                    </td>
                    <td className="py-3.5 px-3 text-[#98A2B3] font-mono text-[11px]">
                      {new Date(item.requestedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-3.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {item.status === 'PENDING' ? (
                        <button
                          onClick={() => handleCancelRequest(item.publicWithdrawalId)}
                          disabled={cancellingId === item.publicWithdrawalId}
                          className="px-2.5 py-1 rounded bg-[#F04438]/10 hover:bg-[#F04438]/20 text-[#F04438] border border-[#F04438]/30 font-medium text-[11px] transition-colors cursor-pointer"
                        >
                          {cancellingId === item.publicWithdrawalId ? 'Cancelling...' : 'Cancel'}
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] font-medium text-[11px] transition-colors cursor-pointer"
                        >
                          Inspect
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspector Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#07101D] border border-white/[0.12] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#F0B90B]" />
                  Withdrawal Audit Inspector
                </h3>
                <p className="text-xs text-[#98A2B3] font-mono">{selectedItem.publicWithdrawalId}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-[#98A2B3] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06]">
                <div>
                  <span className="text-[#98A2B3] block text-[10px] uppercase font-mono">Amount</span>
                  <span className="text-lg font-bold font-mono text-[#F0B90B]">${selectedItem.amount.toFixed(2)} USD</span>
                </div>
                <div>
                  <span className="text-[#98A2B3] block text-[10px] uppercase font-mono">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedItem.status)}</div>
                </div>
              </div>

              <div className="space-y-2 p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#98A2B3]">Channel:</span>
                  <span className="text-white">{formatDestinationLabel(selectedItem.destinationType)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#98A2B3]">Reference Address:</span>
                  <span className="text-white truncate max-w-[200px]">{selectedItem.destinationReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#98A2B3]">Requested At:</span>
                  <span className="text-white">{new Date(selectedItem.requestedAt).toUTCString()}</span>
                </div>
                {selectedItem.approvedAt && (
                  <div className="flex justify-between text-[#32D583]">
                    <span>Approved At:</span>
                    <span>{new Date(selectedItem.approvedAt).toUTCString()}</span>
                  </div>
                )}
                {selectedItem.completedAt && (
                  <div className="flex justify-between text-[#32D583]">
                    <span>Completed At:</span>
                    <span>{new Date(selectedItem.completedAt).toUTCString()}</span>
                  </div>
                )}
                {selectedItem.rejectionReason && (
                  <div className="p-2 rounded bg-[#F04438]/10 text-[#F04438] text-[11px] mt-2">
                    <strong>Rejection Reason:</strong> {selectedItem.rejectionReason}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-bold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
