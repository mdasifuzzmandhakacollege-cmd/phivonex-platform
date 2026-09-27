import React, { useState, useEffect } from 'react';
import {
  Users,
  Coins,
  Copy,
  Check,
  Share2,
  UserCheck,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  Server,
  ArrowUpRight,
  ShieldCheck,
  Layers,
  Award,
  RefreshCw
} from 'lucide-react';
import { UserProfile } from '../../context/AuthContext';
import { buildPublicReferralUrl } from '../../utils/referralUrl';

interface ReferralProfileData {
  publicId: string;
  referralCode: string;
  referralUrl: string;
  sponsor: {
    publicId: string;
    displayName: string;
  } | null;
}

interface DirectReferral {
  publicId: string;
  displayName: string;
  joinedAt: string;
}

interface CommissionRecord {
  publicCommissionId: string;
  referredUserPublicId: string;
  nodePublicId: string;
  amountUsd: number;
  status: 'EARNED' | 'REVERSED';
  earnedAt: string;
  reversedAt?: string | null;
}

interface DirectReferralsViewProps {
  user: UserProfile | null;
  onNavigateTab?: (tab: string) => void;
}

export const DirectReferralsView: React.FC<DirectReferralsViewProps> = ({ user, onNavigateTab }) => {
  const [profileData, setProfileData] = useState<ReferralProfileData | null>(null);
  const [directs, setDirects] = useState<DirectReferral[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [totalEarnedUsd, setTotalEarnedUsd] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    setError(null);

    try {
      const [profRes, directsRes, commsRes] = await Promise.all([
        fetch('/api/referrals/me', { credentials: 'include' }),
        fetch('/api/referrals/direct', { credentials: 'include' }),
        fetch('/api/referral-commissions/me', { credentials: 'include' }),
      ]);

      if (profRes.ok) {
        const prof = await profRes.json();
        setProfileData(prof);
      }

      if (directsRes.ok) {
        const dirData = await directsRes.json();
        setDirects(dirData.referrals || []);
      }

      if (commsRes.ok) {
        const commData = await commsRes.json();
        setCommissions(commData.commissions || []);
        setTotalEarnedUsd(commData.totalEarnedUsd || 0);
      }
    } catch (err: any) {
      console.error('[DirectReferralsView] Failed to fetch referral telemetry:', err);
      setError(err.message || 'Unable to synchronize direct referral data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const effectiveReferralUrl = buildPublicReferralUrl(
    profileData?.referralCode || user?.referralCode || 'PHXGENESIS',
    profileData?.referralUrl
  );

  const handleCopyCode = () => {
    const code = profileData?.referralCode || user?.referralCode;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!effectiveReferralUrl) return;
    navigator.clipboard.writeText(effectiveReferralUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 text-[#00CFFF] animate-spin" />
        <p className="text-xs font-mono text-[#98A2B3] uppercase tracking-wider">
          Querying On-Chain Referral Graph & Commissions...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#00CFFF]/10 text-[#00CFFF] border border-[#00CFFF]/20">
              <Sparkles className="w-3 h-3" />
              DIRECT INCENTIVE PROGRAM
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-[#00FF9D] bg-[#00FF9D]/10 border border-[#00FF9D]/20">
              $50 PER ACTIVE NODE
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Direct Referrals & Commissions
          </h1>
          <p className="text-sm text-[#98A2B3] mt-1">
            Earn an authoritative <span className="text-[#00FF9D] font-semibold">$50 USD</span> for every Genesis Node successfully activated by your directly sponsored operators.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-[#98A2B3] hover:text-white border border-white/[0.08] text-xs font-mono flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh referral metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#00CFFF]' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-center gap-3 text-xs text-[#F04438]">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Metric Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Metric 1: Direct Referrals Count */}
        <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] relative overflow-hidden group hover:border-[#00CFFF]/40 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00CFFF]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[#00CFFF]/10 transition-colors" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-[#98A2B3]">
              Direct Referrals
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-bold text-white tracking-tight">
            {directs.length}
          </div>
          <p className="text-[11px] text-[#98A2B3] mt-2 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-[#00CFFF]" />
            Directly sponsored operators
          </p>
        </div>

        {/* Metric 2: Referral Commission Earned */}
        <div className="p-6 rounded-2xl bg-[#07101D] border border-[#00FF9D]/20 relative overflow-hidden group hover:border-[#00FF9D]/40 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00FF9D]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[#00FF9D]/10 transition-colors" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-[#98A2B3]">
              Referral Commission Earned
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#00FF9D]/10 border border-[#00FF9D]/20 flex items-center justify-center text-[#00FF9D]">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-bold text-[#00FF9D] tracking-tight">
            ${totalEarnedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#98A2B3] mt-2 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[#00FF9D]" />
            <span>Cumulative settled referral rewards</span>
          </p>
        </div>

        {/* Metric 3: Active Node Activations */}
        <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] relative overflow-hidden group hover:border-[#F79009]/40 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#F79009]/5 rounded-full blur-2xl pointer-events-none group-hover:bg-[#F79009]/10 transition-colors" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-wider text-[#98A2B3]">
              Settled Commissions
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#F79009]/10 border border-[#F79009]/20 flex items-center justify-center text-[#F79009]">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-bold text-white tracking-tight">
            {commissions.filter((c) => c.status === 'EARNED').length}
          </div>
          <p className="text-[11px] text-[#98A2B3] mt-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#F79009]" />
            Eligible Genesis Nodes activated
          </p>
        </div>
      </div>

      {/* Referral Link & Code Sharing Box */}
      <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] space-y-6">
        <div className="flex items-center gap-2">
          <Share2 className="w-5 h-5 text-[#00CFFF]" />
          <h2 className="text-base font-bold text-white">Your Operator Referral Credentials</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Referral Code */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-[#98A2B3] uppercase tracking-wider">
              My Referral Code
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/[0.08] font-mono text-sm font-bold text-[#00CFFF] tracking-wider select-all">
                {profileData?.referralCode || user?.referralCode || 'PHXGENESIS'}
              </div>
              <button
                onClick={handleCopyCode}
                className="px-4 py-3 rounded-xl bg-[#00CFFF]/10 hover:bg-[#00CFFF]/20 text-[#00CFFF] border border-[#00CFFF]/30 font-mono text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
              >
                {copiedCode ? <Check className="w-4 h-4 text-[#00FF9D]" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Referral Link */}
          <div className="space-y-2">
            <label className="text-xs font-mono text-[#98A2B3] uppercase tracking-wider">
              Referral Link (Public Invitation)
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-4 py-3 rounded-xl bg-black/40 border border-white/[0.08] font-mono text-xs text-[#F7FAFC] truncate select-all">
                {effectiveReferralUrl}
              </div>
              <button
                onClick={handleCopyLink}
                className="px-4 py-3 rounded-xl bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-[#05070B] font-mono text-xs font-bold flex items-center gap-2 transition-all cursor-pointer min-h-[44px]"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </div>

        {profileData?.sponsor && (
          <div className="pt-4 border-t border-white/[0.06] flex items-center justify-between text-xs text-[#98A2B3]">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#00FF9D]" />
              <span>Your Direct Sponsor:</span>
              <span className="font-mono text-white font-medium">{profileData.sponsor.displayName}</span>
              <span className="font-mono text-[11px] text-[#00CFFF]">({profileData.sponsor.publicId})</span>
            </div>
          </div>
        )}
      </div>

      {/* Two Column Section: Direct Referrals Table + Recent Commissions Table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Column 1: Direct Referrals */}
        <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#00CFFF]" />
              <h3 className="text-sm font-bold text-white">Direct Referrals ({directs.length})</h3>
            </div>
            <span className="text-[11px] font-mono text-[#98A2B3]">Privacy Protected</span>
          </div>

          {directs.length === 0 ? (
            <div className="py-12 px-4 rounded-xl bg-black/20 border border-white/[0.04] text-center space-y-3">
              <Users className="w-8 h-8 text-[#98A2B3]/40 mx-auto" />
              <p className="text-xs text-[#98A2B3]">No directly sponsored operators yet.</p>
              <p className="text-[11px] text-[#98A2B3]/70 max-w-xs mx-auto">
                Share your referral link to onboard operators and earn $50 USD for each Genesis Node they activate.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] overflow-x-auto max-h-[380px] overflow-y-auto custom-scrollbar">
              {directs.map((ref, idx) => (
                <div key={idx} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-xs font-mono text-[#00CFFF] flex-shrink-0">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-white truncate">
                        {ref.displayName}
                      </div>
                      <div className="text-[10px] font-mono text-[#00CFFF] truncate">
                        {ref.publicId}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-[11px] font-mono text-[#98A2B3] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#98A2B3]" />
                      {formatDate(ref.joinedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Referral Commission History */}
        <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#00FF9D]" />
              <h3 className="text-sm font-bold text-white">Recent Commissions ({commissions.length})</h3>
            </div>
            <span className="text-[11px] font-mono text-[#00FF9D] font-semibold">
              ${totalEarnedUsd.toFixed(2)} Total
            </span>
          </div>

          {commissions.length === 0 ? (
            <div className="py-12 px-4 rounded-xl bg-black/20 border border-white/[0.04] text-center space-y-3">
              <Coins className="w-8 h-8 text-[#98A2B3]/40 mx-auto" />
              <p className="text-xs text-[#98A2B3]">No referral commissions generated yet.</p>
              <p className="text-[11px] text-[#98A2B3]/70 max-w-xs mx-auto">
                Commissions are authoritatively credited as soon as your referrals complete their Genesis Node payment settlement.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] overflow-x-auto max-h-[380px] overflow-y-auto custom-scrollbar">
              {commissions.map((comm, idx) => (
                <div key={idx} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white">
                        {comm.publicCommissionId}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                          comm.status === 'EARNED'
                            ? 'bg-[#00FF9D]/10 text-[#00FF9D] border border-[#00FF9D]/30'
                            : 'bg-[#F04438]/10 text-[#F04438] border border-[#F04438]/30'
                        }`}
                      >
                        {comm.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#98A2B3]">
                      <span>Node: <span className="text-[#00CFFF]">{comm.nodePublicId}</span></span>
                      <span>•</span>
                      <span>By: <span className="text-white">{comm.referredUserPublicId}</span></span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-mono font-bold text-[#00FF9D]">
                      +${comm.amountUsd.toFixed(2)}
                    </div>
                    <div className="text-[10px] font-mono text-[#98A2B3]">
                      {formatDateTime(comm.earnedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Program Disclaimers & Future Roadmap */}
      <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-start gap-3 text-xs text-[#98A2B3]">
        <Layers className="w-4 h-4 text-[#00CFFF] flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-white font-medium">Direct Referral Program Rules & Ledger Policy</p>
          <p className="text-[11px] leading-relaxed">
            Direct referral commissions are computed upon verified payment settlement and node activation ($50.00 USD per eligible Genesis Node). Commission entitlement is recorded authoritatively in the protocol ledger. Wallet withdrawals and Binary Team Matching will become active in subsequent protocol phases.
          </p>
        </div>
      </div>
    </div>
  );
};
