import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  User,
  Mail,
  Globe,
  Tag,
  Copy,
  Check,
  Share2,
  UserCheck,
  Clock,
  Server,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  RotateCcw,
  Coins,
  Users,
  GitFork,
  ChevronRight,
  RefreshCw,
  Zap,
  Activity,
  Trophy,
} from 'lucide-react';
import { UserProfile } from '../../context/AuthContext';
import { buildPublicReferralUrl } from '../../utils/referralUrl';
import { PhivoCoinIcon, UsdtIcon } from '../brand/CryptoIcons';
import { TokenPriceTrendChart } from './TokenPriceTrendChart';
import { PromotionalBannerCarousel } from './PromotionalBannerCarousel';
import { useSystemConfig } from '../../context/SystemConfigContext';
import { getTransactionUserDescription } from '../../utils/transactionDisplay';

// TypeScript Interfaces for Authoritative Data
interface ReferralMeResponse {
  publicId: string;
  referralCode: string;
  referralUrl: string;
  sponsor: {
    publicId: string;
    displayName: string;
  } | null;
}

interface WalletBreakdown {
  referral: number;
  matching: number;
  promotion: number;
  nodeReward?: number;
  deposit?: number;
  swap?: number;
}

interface WalletSummary {
  totalEarned: number;
  totalReversed: number;
  ledgerBalance: number;
  availableBalance?: number;
  phivoBalance?: number;
  transactionCount: number;
  breakdown: WalletBreakdown;
  grossBreakdown?: WalletBreakdown;
}

interface LedgerTransactionItem {
  id: string;
  publicTxnId: string;
  userId: string;
  entryType: 'CREDIT' | 'DEBIT' | 'REVERSAL';
  sourceType: string;
  sourceId: string;
  sourceRef: string;
  description: string;
  amount: number;
  currency: string;
  status: 'SETTLED' | 'REVERSED' | 'PENDING';
  createdAt: string;
}

interface NodeSummaryData {
  totalNodes: number;
  activeNodes: number;
  totalRewardsPhivo: number;
  latestRewardEpoch?: string | null;
}

interface MatchingSummaryData {
  todayVolume: {
    left: number;
    right: number;
  };
  carry: {
    left: number;
    right: number;
  };
  totalMatchingEarnedUsd: number;
  nextSettlement?: {
    scheduledTime: string;
    nextSettlementIso: string;
  };
}

interface UserRankStatusData {
  currentRank: string;
  currentRankName: string;
  nextRank: string | null;
  nextRankName: string | null;
  stageProgress?: {
    matching?: {
      leftProgress: number;
      rightProgress: number;
      requiredLeft: number;
      requiredRight: number;
      progressPct: number;
    };
    leadership?: {
      progressPct: number;
      requiredLeaderRank?: string;
    };
  };
  rewardUsd?: number;
}

interface OverviewViewProps {
  user: UserProfile | null;
  onNavigateTab?: (tab: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ user, onNavigateTab }) => {
  const { coinPriceUsdt, nodeBasePriceUsd, genesisNodeCap, lastUpdated } = useSystemConfig();

  // 1. Data States
  const [referralData, setReferralData] = useState<ReferralMeResponse | null>(null);
  const [walletData, setWalletData] = useState<WalletSummary | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<LedgerTransactionItem[]>([]);
  const [nodeData, setNodeData] = useState<NodeSummaryData | null>(null);
  const [matchingData, setMatchingData] = useState<MatchingSummaryData | null>(null);
  const [rankData, setRankData] = useState<UserRankStatusData | null>(null);
  const [directReferralsCount, setDirectReferralsCount] = useState<number>(0);
  const [phivoRate, setPhivoRate] = useState<number>(0.1);

  // 2. UI & Interaction States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch all authoritative dashboard data in parallel
  const fetchDashboardData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);

    try {
      const [
        refRes,
        walletRes,
        txRes,
        nodesRes,
        rewardsRes,
        matchingRes,
        rankRes,
        directsRes,
        econRes
      ] = await Promise.allSettled([
        fetch('/api/referrals/me', { credentials: 'include' }),
        fetch('/api/wallet/me', { credentials: 'include' }),
        fetch('/api/wallet/transactions?page=1&limit=5', { credentials: 'include' }),
        fetch('/api/nodes/me', { credentials: 'include' }),
        fetch('/api/rewards/me', { credentials: 'include' }),
        fetch('/api/matching/summary', { credentials: 'include' }),
        fetch('/api/promotions/my-status', { credentials: 'include' }),
        fetch('/api/referrals/direct', { credentials: 'include' }),
        fetch('/api/economic/public'),
      ]);

      // 1. Referral Me
      if (refRes.status === 'fulfilled' && refRes.value.ok) {
        const data = await refRes.value.json();
        setReferralData(data);
      }

      // 2. Wallet Me
      if (walletRes.status === 'fulfilled' && walletRes.value.ok) {
        const data = await walletRes.value.json();
        setWalletData(data);
      }

      // 3. Recent Transactions
      if (txRes.status === 'fulfilled' && txRes.value.ok) {
        const data = await txRes.value.json();
        setRecentTransactions(data.transactions || []);
      }

      // 4. Node Summary
      let totalNodesCount = 0;
      let activeNodesCount = 0;
      if (nodesRes.status === 'fulfilled' && nodesRes.value.ok) {
        const data = await nodesRes.value.json();
        const userNodes = data.nodes || [];
        totalNodesCount = userNodes.length;
        activeNodesCount = userNodes.filter((n: any) => n.status === 'ACTIVE').length;
      }

      let totalMiningRewards = 0;
      let latestEpoch = null;
      if (rewardsRes.status === 'fulfilled' && rewardsRes.value.ok) {
        const rData = await rewardsRes.value.json();
        totalMiningRewards = rData.totalAccrued || rData.totalRewards || 0;
        latestEpoch = rData.latestEpoch?.publicEpochId || null;
      }

      setNodeData({
        totalNodes: totalNodesCount,
        activeNodes: activeNodesCount,
        totalRewardsPhivo: totalMiningRewards,
        latestRewardEpoch: latestEpoch,
      });

      // 5. Binary Matching
      if (matchingRes.status === 'fulfilled' && matchingRes.value.ok) {
        const data = await matchingRes.value.json();
        setMatchingData(data);
      }

      // 6. Promotions / Rank
      if (rankRes.status === 'fulfilled' && rankRes.value.ok) {
        const data = await rankRes.value.json();
        setRankData(data);
      }

      // 7. Direct Referrals Count
      if (directsRes.status === 'fulfilled' && directsRes.value.ok) {
        const data = await directsRes.value.json();
        setDirectReferralsCount(Array.isArray(data.referrals) ? data.referrals.length : 0);
      }

      // 8. Economic Public (Rate)
      if (econRes.status === 'fulfilled' && econRes.value.ok) {
        const data = await econRes.value.json();
        if (typeof data.phivoPriceUsd === 'number') {
          setPhivoRate(data.phivoPriceUsd);
        }
      }
    } catch (err: any) {
      console.warn('[OverviewView] Data fetch warning:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Auto refresh every 20 seconds
    const interval = setInterval(() => {
      fetchDashboardData(false);
    }, 20000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Synchronize PHIVO conversion rate live from system config
  useEffect(() => {
    if (typeof coinPriceUsdt === 'number' && coinPriceUsdt > 0) {
      setPhivoRate(coinPriceUsdt);
    }
  }, [coinPriceUsdt]);

  // Live refresh overview metrics on system config or promotional updates
  useEffect(() => {
    fetchDashboardData(false);
  }, [lastUpdated, fetchDashboardData]);

  // Live refresh on balance, transaction, or notification updates
  useEffect(() => {
    const handleUpdate = () => {
      fetchDashboardData(false);
    };
    window.addEventListener('phivonex:balance-or-tx-updated', handleUpdate);
    return () => window.removeEventListener('phivonex:balance-or-tx-updated', handleUpdate);
  }, [fetchDashboardData]);

  // Copy Handlers
  const rawReferralCode = referralData?.referralCode || user?.referralCode;
  const isReferralPending = !rawReferralCode || rawReferralCode === 'PHX-PENDING' || rawReferralCode.trim() === '';
  const displayReferralCode = isReferralPending ? 'Not Available Yet' : rawReferralCode;

  const handleCopyId = () => {
    const id = referralData?.publicId || user?.publicId;
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const effectiveReferralUrl = isReferralPending
    ? ''
    : buildPublicReferralUrl(rawReferralCode, referralData?.referralUrl);

  const handleCopyCode = () => {
    if (isReferralPending || !rawReferralCode) return;
    navigator.clipboard.writeText(rawReferralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (isReferralPending || !effectiveReferralUrl) return;
    navigator.clipboard.writeText(effectiveReferralUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Safe navigation helper
  const navigateTo = (tabKey: string) => {
    if (onNavigateTab) {
      onNavigateTab(tabKey);
    }
  };

  // Calculations & Formatters
  const firstName = useMemo(() => {
    if (!user?.fullName) return 'Member';
    const parts = user.fullName.trim().split(' ');
    return parts[0] || 'Member';
  }, [user?.fullName]);

  const availableUsdt = walletData?.availableBalance ?? walletData?.ledgerBalance ?? 0;
  const phivoBalance = walletData?.phivoBalance ?? 0;
  const phivoValueUsdt = phivoBalance * phivoRate;
  const totalEarnedUsd = walletData?.totalEarned ?? 0;
  const activeNodesCount = nodeData?.activeNodes ?? 0;
  const currentRankName = rankData?.currentRankName || 'Standard Member';
  const nextRankName = rankData?.nextRankName;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not Available';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Not Available';
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return 'Not Available';
    }
  };

  const formatCurrency = (val: number, minimumFractionDigits = 2) => {
    return val.toLocaleString('en-US', {
      minimumFractionDigits,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-12">
      {/* ========================================================
          0. DYNAMIC PROMOTIONAL & PROTOCOL NOTICES
         ======================================================== */}
      <PromotionalBannerCarousel onNavigateTab={navigateTo} />

      {/* ========================================================
          1. WELCOME / ACCOUNT HERO (Compact & Premium)
         ======================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#07101D] via-[#0B1728] to-[#07101D] border border-white/[0.08] p-5 sm:p-7 shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-[#00CFFF]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#32D583]/10 border border-[#32D583]/25 text-[#32D583] text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#32D583] animate-pulse" />
                Account Active
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[#98A2B3] text-[11px]">
                <Mail className="w-3 h-3 text-[#00CFFF]" />
                {user?.emailVerified ? 'Email Verified' : 'Primary Confirmed'}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[#98A2B3] text-[11px]">
                <Globe className="w-3 h-3 text-[#168BFF]" />
                Network Synchronized
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="text-xs sm:text-sm text-[#98A2B3] max-w-2xl leading-relaxed">
              Manage your PHIVONEX nodes, wallet balance, network growth, and daily rewards from your unified dashboard.
            </p>
          </div>

          {/* Sync & Refresh Status Trigger */}
          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-medium text-[#98A2B3] hover:text-white transition-all cursor-pointer min-h-[44px] shadow-sm active:scale-95 disabled:opacity-50"
              title="Refresh dashboard metrics"
              aria-label="Refresh dashboard data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#00CFFF] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Up to date'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          2. PRIMARY KPI STRIP (6 Compact & High-Impact Cards)
         ======================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* KPI 1: Available USDT */}
        <div
          onClick={() => navigateTo('wallet')}
          className="p-4 sm:p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#00CFFF]/40 transition-all duration-200 shadow-lg cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs text-[#98A2B3] mb-2">
            <span className="font-medium text-[11px] uppercase tracking-wider">USDT Balance</span>
            <div className="w-7 h-7 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF] group-hover:scale-110 transition-transform">
              <UsdtIcon size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-white tabular-nums">
              ${formatCurrency(availableUsdt)}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#00CFFF] mt-1 font-medium group-hover:translate-x-0.5 transition-transform">
              <span>Deposit / Manage</span>
              <ArrowRight className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* KPI 2: PHIVO Balance */}
        <div
          onClick={() => navigateTo('swap')}
          className="p-4 sm:p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#00CFFF]/40 transition-all duration-200 shadow-lg cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs text-[#98A2B3] mb-2">
            <span className="font-medium text-[11px] uppercase tracking-wider">PHIVO Balance</span>
            <div className="w-7 h-7 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF] group-hover:scale-110 transition-transform">
              <PhivoCoinIcon size={16} />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-[#00CFFF] tabular-nums">
              {formatCurrency(phivoBalance)}
            </div>
            <div className="text-[11px] text-[#98A2B3] mt-1">
              ≈ ${formatCurrency(phivoValueUsdt)} USDT
            </div>
          </div>
        </div>

        {/* KPI 3: Active Nodes */}
        <div
          onClick={() => navigateTo('nodes')}
          className="p-4 sm:p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#32D583]/40 transition-all duration-200 shadow-lg cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs text-[#98A2B3] mb-2">
            <span className="font-medium text-[11px] uppercase tracking-wider">Active Nodes</span>
            <div className="w-7 h-7 rounded-lg bg-[#32D583]/10 border border-[#32D583]/20 flex items-center justify-center text-[#32D583] group-hover:scale-110 transition-transform">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-white tabular-nums flex items-baseline gap-1.5">
              <span>{activeNodesCount}</span>
              <span className="text-xs font-normal text-[#98A2B3]">Nodes</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#32D583] mt-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#32D583]" />
              <span>{activeNodesCount > 0 ? 'Mining Active' : 'Ready to activate'}</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Current Rank */}
        <div
          onClick={() => navigateTo('rewards')}
          className="p-4 sm:p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#F59E0B]/40 transition-all duration-200 shadow-lg cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs text-[#98A2B3] mb-2">
            <span className="font-medium text-[11px] uppercase tracking-wider">Current Rank</span>
            <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B] group-hover:scale-110 transition-transform">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-base sm:text-lg font-bold text-white truncate">
              {currentRankName}
            </div>
            <div className="text-[11px] text-[#F59E0B] mt-1 font-medium truncate">
              {nextRankName ? `Next: ${nextRankName}` : 'Top Tier'}
            </div>
          </div>
        </div>

        {/* KPI 5: Total Earnings */}
        <div
          onClick={() => navigateTo('wallet')}
          className="p-4 sm:p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#32D583]/40 transition-all duration-200 shadow-lg cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs text-[#98A2B3] mb-2">
            <span className="font-medium text-[11px] uppercase tracking-wider">Total Earnings</span>
            <div className="w-7 h-7 rounded-lg bg-[#32D583]/10 border border-[#32D583]/20 flex items-center justify-center text-[#32D583] group-hover:scale-110 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-[#32D583] tabular-nums">
              ${formatCurrency(totalEarnedUsd)}
            </div>
            <div className="text-[11px] text-[#98A2B3] mt-1">
              All-time cumulative
            </div>
          </div>
        </div>

        {/* KPI 6: Direct Referrals */}
        <div
          onClick={() => navigateTo('referrals')}
          className="p-4 sm:p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#168BFF]/40 transition-all duration-200 shadow-lg cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs text-[#98A2B3] mb-2">
            <span className="font-medium text-[11px] uppercase tracking-wider">Direct Referrals</span>
            <div className="w-7 h-7 rounded-lg bg-[#168BFF]/10 border border-[#168BFF]/20 flex items-center justify-center text-[#168BFF] group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-mono font-bold text-white tabular-nums flex items-baseline gap-1.5">
              <span>{directReferralsCount}</span>
              <span className="text-xs font-normal text-[#98A2B3]">Members</span>
            </div>
            <div className="text-[11px] text-[#168BFF] mt-1 font-medium">
              $50 direct reward per eligible node
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. QUICK ACTIONS STRIP (Clean & Instant)
         ======================================================== */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#98A2B3] font-mono flex items-center gap-1.5 px-1">
          <Zap className="w-3.5 h-3.5 text-[#00CFFF]" />
          <span>Quick Actions</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Action 1: Deposit */}
          <button
            onClick={() => navigateTo('deposit')}
            className="p-3.5 rounded-xl bg-[#07101D] hover:bg-[#0B1728] border border-white/[0.08] hover:border-[#00CFFF]/40 transition-all duration-150 flex items-center gap-3 text-left cursor-pointer min-h-[52px] group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF] shrink-0 group-hover:scale-105 transition-transform">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">Deposit USDT</span>
              <span className="text-[10px] text-[#98A2B3] block truncate">BEP-20 Network</span>
            </div>
          </button>

          {/* Action 2: Activate Node */}
          <button
            onClick={() => navigateTo('nodes')}
            className="p-3.5 rounded-xl bg-[#07101D] hover:bg-[#0B1728] border border-white/[0.08] hover:border-[#32D583]/40 transition-all duration-150 flex items-center gap-3 text-left cursor-pointer min-h-[52px] group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#32D583]/10 border border-[#32D583]/20 flex items-center justify-center text-[#32D583] shrink-0 group-hover:scale-105 transition-transform">
              <Server className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">Activate Node</span>
              <span className="text-[10px] text-[#32D583] block truncate">$1,000 / Genesis</span>
            </div>
          </button>

          {/* Action 3: Swap PHIVO */}
          <button
            onClick={() => navigateTo('swap')}
            className="p-3.5 rounded-xl bg-[#07101D] hover:bg-[#0B1728] border border-white/[0.08] hover:border-[#00CFFF]/40 transition-all duration-150 flex items-center gap-3 text-left cursor-pointer min-h-[52px] group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF] shrink-0 group-hover:scale-105 transition-transform">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">Swap PHIVO</span>
              <span className="text-[10px] text-[#98A2B3] block truncate">Instant Conversion</span>
            </div>
          </button>

          {/* Action 4: Withdraw */}
          <button
            onClick={() => navigateTo('withdrawals')}
            className="p-3.5 rounded-xl bg-[#07101D] hover:bg-[#0B1728] border border-white/[0.08] hover:border-[#F04438]/40 transition-all duration-150 flex items-center gap-3 text-left cursor-pointer min-h-[52px] group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#F04438]/10 border border-[#F04438]/20 flex items-center justify-center text-[#F04438] shrink-0 group-hover:scale-105 transition-transform">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">Withdraw</span>
              <span className="text-[10px] text-[#98A2B3] block truncate">External Wallet</span>
            </div>
          </button>

          {/* Action 5: Invite */}
          <button
            onClick={() => navigateTo('referrals')}
            className="col-span-2 sm:col-span-1 p-3.5 rounded-xl bg-[#07101D] hover:bg-[#0B1728] border border-white/[0.08] hover:border-[#168BFF]/40 transition-all duration-150 flex items-center gap-3 text-left cursor-pointer min-h-[52px] group"
          >
            <div className="w-9 h-9 rounded-lg bg-[#168BFF]/10 border border-[#168BFF]/20 flex items-center justify-center text-[#168BFF] shrink-0 group-hover:scale-105 transition-transform">
              <Share2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">Invite &amp; Earn</span>
              <span className="text-[10px] text-[#168BFF] block truncate">Referral Link</span>
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================
          4. PHIVO MARKET / ECOSYSTEM CARD (Polished & Compact)
         ======================================================== */}
      <TokenPriceTrendChart onNavigateTab={onNavigateTab} compact={false} />

      {/* ========================================================
          5. CORE PERFORMANCE GRID (2 Column: Nodes & Binary)
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Genesis Node Summary */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#32D583]/10 border border-[#32D583]/20 flex items-center justify-center text-[#32D583]">
                  <Server className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Genesis Node Summary</h3>
              </div>
              <span className="text-[11px] font-mono text-[#32D583] bg-[#32D583]/10 border border-[#32D583]/25 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#32D583] animate-pulse" />
                <span>Mining Active</span>
              </span>
            </div>

            <p className="text-xs text-[#98A2B3] leading-relaxed">
              Your active Genesis Nodes validate protocol consensus and earn daily PHIVO mining rewards through the halving schedule.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] text-[#98A2B3] uppercase tracking-wider font-mono block">Active Nodes</span>
                <span className="text-lg font-bold font-mono text-white mt-0.5 block tabular-nums">
                  {nodeData?.activeNodes ?? 0}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] text-[#98A2B3] uppercase tracking-wider font-mono block">Total Owned</span>
                <span className="text-lg font-bold font-mono text-white mt-0.5 block tabular-nums">
                  {nodeData?.totalNodes ?? 0}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <span className="text-[10px] text-[#98A2B3] uppercase tracking-wider font-mono block">Mined PHIVO</span>
                <span className="text-lg font-bold font-mono text-[#00CFFF] mt-0.5 block tabular-nums">
                  {formatCurrency(nodeData?.totalRewardsPhivo ?? 0)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => navigateTo('nodes')}
              className="flex-1 py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
            >
              <span>Manage Nodes</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#98A2B3]" />
            </button>
            <button
              onClick={() => navigateTo('nodes')}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-[#05070B] text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] shadow-lg shadow-[#00CFFF]/15"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Activate Node</span>
            </button>
          </div>
        </div>

        {/* Right Column: Binary Matching & Network Progress */}
        <div className="p-5 sm:p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF]">
                  <GitFork className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Binary Network Progress</h3>
              </div>
              <span className="text-[11px] font-mono text-[#98A2B3] bg-white/[0.04] px-2 py-0.5 rounded-md flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#00CFFF]" />
                <span>Daily 00:00 UTC+6</span>
              </span>
            </div>

            <p className="text-xs text-[#98A2B3] leading-relaxed">
              Paired sales volume between Left and Right team legs settles daily. Remaining units carry forward to the next cycle.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Left Leg */}
              <div className="p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#98A2B3]">
                  <span className="font-semibold text-[#00CFFF]">LEFT LEG</span>
                  <span className="text-[10px] font-mono">Today / Carry</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-mono font-bold text-white tabular-nums">
                    {matchingData?.todayVolume?.left ?? 0}
                  </span>
                  <span className="text-xs font-mono text-[#98A2B3] tabular-nums">
                    (+{matchingData?.carry?.left ?? 0} carry)
                  </span>
                </div>
              </div>

              {/* Right Leg */}
              <div className="p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#98A2B3]">
                  <span className="font-semibold text-[#32D583]">RIGHT LEG</span>
                  <span className="text-[10px] font-mono">Today / Carry</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-mono font-bold text-white tabular-nums">
                    {matchingData?.todayVolume?.right ?? 0}
                  </span>
                  <span className="text-xs font-mono text-[#98A2B3] tabular-nums">
                    (+{matchingData?.carry?.right ?? 0} carry)
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <div>
              <span className="text-[10px] text-[#98A2B3] block uppercase tracking-wider font-mono">Total Matching Earned</span>
              <span className="text-sm font-bold font-mono text-[#32D583] tabular-nums">
                ${formatCurrency(matchingData?.totalMatchingEarnedUsd ?? walletData?.breakdown?.matching ?? 0)}
              </span>
            </div>
            <button
              onClick={() => navigateTo('network')}
              className="py-2 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px]"
            >
              <span>View Network Tree</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#00CFFF]" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================
          6. PROMOTION & RANK PROGRESS (Visual Tier Journey)
         ======================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center text-[#F59E0B]">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Leadership &amp; Promotion Progress</h3>
              <p className="text-[11px] text-[#98A2B3]">Track your progress through PHIVONEX promotion ranks.</p>
            </div>
          </div>
          <button
            onClick={() => navigateTo('rewards')}
            className="text-xs text-[#00CFFF] hover:text-white font-medium flex items-center gap-1 self-start sm:self-auto cursor-pointer transition-colors"
          >
            <span>View Rank Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Current vs Next Badge */}
          <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-2">
            <span className="text-[10px] text-[#98A2B3] uppercase tracking-wider font-mono block">Career Rank</span>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">{currentRankName}</span>
              {nextRankName && (
                <>
                  <ArrowRight className="w-4 h-4 text-[#F59E0B]" />
                  <span className="text-sm font-bold text-[#F59E0B]">{nextRankName}</span>
                </>
              )}
            </div>
            <span className="text-[11px] text-[#98A2B3] block">
              {rankData?.rewardUsd ? `Next Milestone Reward: $${formatCurrency(rankData.rewardUsd)}` : 'Active Network Participation'}
            </span>
          </div>

          {/* Matching Leg Progress Bars */}
          <div className="md:col-span-2 p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#98A2B3]">Left Team Requirement:</span>
                <span className="text-white font-bold tabular-nums">
                  {rankData?.stageProgress?.matching?.leftProgress ?? 0} / {rankData?.stageProgress?.matching?.requiredLeft ?? 20}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#00CFFF] to-[#168BFF] rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((rankData?.stageProgress?.matching?.leftProgress ?? 0) /
                        (rankData?.stageProgress?.matching?.requiredLeft || 20)) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#98A2B3]">Right Team Requirement:</span>
                <span className="text-white font-bold tabular-nums">
                  {rankData?.stageProgress?.matching?.rightProgress ?? 0} / {rankData?.stageProgress?.matching?.requiredRight ?? 20}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#32D583] to-[#12B76A] rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      100,
                      ((rankData?.stageProgress?.matching?.rightProgress ?? 0) /
                        (rankData?.stageProgress?.matching?.requiredRight || 20)) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          7. REFERRAL SNAPSHOT (Single, Clean, Zero-Duplicate)
         ======================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#07101D] via-[#0A1628] to-[#07101D] border border-white/[0.08] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF]">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Your Referral Link &amp; Code</h3>
              <p className="text-[11px] text-[#98A2B3]">$50 direct referral reward per eligible activated node.</p>
            </div>
          </div>
          <button
            onClick={() => navigateTo('referrals')}
            className="text-xs text-[#00CFFF] hover:text-white font-medium flex items-center gap-1 self-start sm:self-auto cursor-pointer transition-colors"
          >
            <span>View All Referrals ({directReferralsCount})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Referral Code Box */}
          <div className="p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-2 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-[#98A2B3] uppercase tracking-wider font-mono block">Your Referral Code</span>
              <span className={`text-xl font-mono font-bold mt-0.5 block tracking-wider ${isReferralPending ? 'text-[#98A2B3] text-sm' : 'text-[#00CFFF]'}`}>
                {displayReferralCode}
              </span>
            </div>
            <button
              onClick={handleCopyCode}
              disabled={isReferralPending}
              className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[40px] ${
                isReferralPending
                  ? 'bg-white/[0.02] border-white/[0.04] text-[#667085] cursor-not-allowed'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08] text-white cursor-pointer'
              }`}
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-[#32D583]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
            </button>
          </div>

          {/* Referral Link & 1-Click Share */}
          <div className="md:col-span-2 p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-2 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-[#98A2B3] uppercase tracking-wider font-mono block">Registration Link</span>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-1">
                <input
                  type="text"
                  readOnly
                  value={isReferralPending ? 'Referral link generating...' : effectiveReferralUrl}
                  className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-xs font-mono text-[#98A2B3] select-all focus:outline-none min-h-[40px]"
                />
                <button
                  onClick={handleCopyLink}
                  disabled={isReferralPending}
                  className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shrink-0 min-h-[40px] ${
                    isReferralPending
                      ? 'bg-white/[0.04] border border-white/[0.08] text-[#667085] cursor-not-allowed'
                      : 'bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-[#05070B] cursor-pointer'
                  }`}
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-[#05070B]" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Sponsor attribution */}
            <div className="flex items-center gap-2 text-[11px] text-[#98A2B3] pt-1 border-t border-white/[0.04]">
              <UserCheck className="w-3.5 h-3.5 text-[#32D583]" />
              <span>
                {referralData?.sponsor ? (
                  <>Sponsor: <strong className="text-white font-medium">{referralData.sponsor.displayName}</strong> ({referralData.sponsor.publicId})</>
                ) : (
                  <>Direct Genesis Account (No intermediate sponsor)</>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          8. WALLET & EARNINGS BREAKDOWN (Clean Financial Summary)
         ======================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF]">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Wallet &amp; Earnings Breakdown</h3>
              <p className="text-[11px] text-[#98A2B3]">Consolidated summary of your multi-stream earnings.</p>
            </div>
          </div>
          <button
            onClick={() => navigateTo('wallet')}
            className="text-xs text-[#00CFFF] hover:text-white font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Open Wallet</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Direct Referral Bonus */}
          <div className="p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
            <span className="text-[10px] text-[#98A2B3] uppercase tracking-wider font-mono block">Direct Referrals</span>
            <span className="text-base sm:text-lg font-mono font-bold text-white tabular-nums block">
              ${formatCurrency(walletData?.breakdown?.referral ?? 0)}
            </span>
            <span className="text-[10px] text-[#98A2B3] block">$50/node commission</span>
          </div>

          {/* Daily Matching Bonus */}
          <div className="p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
            <span className="text-[10px] text-[#98A2B3] uppercase tracking-wider font-mono block">Binary Matching</span>
            <span className="text-base sm:text-lg font-mono font-bold text-[#32D583] tabular-nums block">
              ${formatCurrency(walletData?.breakdown?.matching ?? 0)}
            </span>
            <span className="text-[10px] text-[#98A2B3] block">Paired volume settlements</span>
          </div>

          {/* Promotion Milestones */}
          <div className="p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
            <span className="text-[10px] text-[#98A2B3] uppercase tracking-wider font-mono block">Promotion Rewards</span>
            <span className="text-base sm:text-lg font-mono font-bold text-[#F59E0B] tabular-nums block">
              ${formatCurrency(walletData?.breakdown?.promotion ?? 0)}
            </span>
            <span className="text-[10px] text-[#98A2B3] block">Rank advancement bonuses</span>
          </div>

          {/* Node Rewards */}
          <div className="p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
            <span className="text-[10px] text-[#98A2B3] uppercase tracking-wider font-mono block">Node Mining</span>
            <span className="text-base sm:text-lg font-mono font-bold text-[#00CFFF] tabular-nums block">
              {formatCurrency(nodeData?.totalRewardsPhivo ?? 0)} <span className="text-xs">PHIVO</span>
            </span>
            <span className="text-[10px] text-[#98A2B3] block">Genesis validator rewards</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          9. RECENT ACTIVITY FEED (5 Latest Events)
         ======================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white">
              <Activity className="w-4 h-4 text-[#00CFFF]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Recent Account Activity</h3>
              <p className="text-[11px] text-[#98A2B3]">Latest settled transactions and network rewards.</p>
            </div>
          </div>
          <button
            onClick={() => navigateTo('wallet')}
            className="text-xs text-[#00CFFF] hover:text-white font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>View All Transactions</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto text-[#98A2B3]">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-xs text-[#98A2B3]">No transactions recorded yet.</p>
            <p className="text-[11px] text-[#667085]">Activate a node or make a deposit to start earning rewards.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04] overflow-hidden">
            {recentTransactions.map((tx) => {
              const isCredit = tx.entryType === 'CREDIT';
              return (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        isCredit
                          ? 'bg-[#32D583]/10 border-[#32D583]/20 text-[#32D583]'
                          : 'bg-[#F04438]/10 border-[#F04438]/20 text-[#F04438]'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-white block truncate">
                        {getTransactionUserDescription(tx)}
                      </span>
                      <span className="text-[10px] text-[#98A2B3] font-mono block">
                        {formatDate(tx.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-mono font-bold block tabular-nums ${
                        isCredit ? 'text-[#32D583]' : 'text-white'
                      }`}
                    >
                      {isCredit ? '+' : '-'}${formatCurrency(tx.amount)} {tx.currency}
                    </span>
                    <span className="text-[10px] font-mono text-[#32D583] inline-flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-[#32D583]" />
                      <span>{tx.status}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================
          10. ACCOUNT PROFILE SNAPSHOT (Compact 1-Card Footer)
         ======================================================== */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#98A2B3]">
              <User className="w-4 h-4 text-[#00CFFF]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Account Profile Snapshot</h3>
              <p className="text-[11px] text-[#98A2B3]">Verified account attributes and registry identifier.</p>
            </div>
          </div>
          <button
            onClick={() => navigateTo('profile')}
            className="text-xs text-[#00CFFF] hover:text-white font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>View Full Profile</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* Public PHIVONEX ID */}
          <div className="p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-mono text-[#98A2B3] uppercase tracking-wider block">PHIVONEX ID</span>
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-mono font-bold text-[#00CFFF] truncate">
                {referralData?.publicId || user?.publicId || 'PHX-PENDING'}
              </span>
              <button
                onClick={handleCopyId}
                className="p-1 text-[#98A2B3] hover:text-white transition-colors cursor-pointer"
                title="Copy ID"
                aria-label="Copy PHIVONEX ID"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-[#32D583]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Account Status */}
          <div className="p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-mono text-[#98A2B3] uppercase tracking-wider block">Status</span>
            <span className="text-xs sm:text-sm font-bold text-[#32D583] flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#32D583]" />
              <span>{user?.status ? user.status.toUpperCase() : 'ACTIVE'}</span>
            </span>
          </div>

          {/* Country */}
          <div className="p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-mono text-[#98A2B3] uppercase tracking-wider block">Country</span>
            <span className="text-xs sm:text-sm font-semibold text-white truncate block">
              {user?.country && user.country.trim() !== '' ? user.country : 'Not Set'}
            </span>
          </div>

          {/* Member Since */}
          <div className="p-3.5 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
            <span className="text-[10px] font-mono text-[#98A2B3] uppercase tracking-wider block">Member Since</span>
            <span className="text-xs sm:text-sm font-semibold text-white truncate block">
              {formatDate(user?.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
