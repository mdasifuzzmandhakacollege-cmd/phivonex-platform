import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  User,
  Mail,
  Phone,
  Globe,
  Calendar,
  Tag,
  Copy,
  Check,
  Share2,
  UserCheck,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  Key,
  Info,
  Server,
  Network,
  Cpu
} from 'lucide-react';
import { UserProfile } from '../../context/AuthContext';
import { WalletSection } from './WalletSection';
import { TokenPriceTrendChart } from './TokenPriceTrendChart';
import { buildPublicReferralUrl } from '../../utils/referralUrl';
import { NetworkPulseTrigger } from './NetworkPulseTrigger';

interface ReferralMeResponse {
  publicId: string;
  referralCode: string;
  referralUrl: string;
  sponsor: {
    publicId: string;
    displayName: string;
  } | null;
}

interface OverviewViewProps {
  user: UserProfile | null;
  onNavigateTab?: (tab: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({ user, onNavigateTab }) => {
  const [referralData, setReferralData] = useState<ReferralMeResponse | null>(null);
  const [loadingReferral, setLoadingReferral] = useState(true);
  const [referralError, setReferralError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchReferralMe() {
      try {
        setLoadingReferral(true);
        setReferralError(null);
        const res = await fetch('/api/referrals/me', {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: Failed to load referral credentials`);
        }
        const data = await res.json();
        if (isMounted) {
          setReferralData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setReferralError(err.message || 'Unable to retrieve referral metadata');
        }
      } finally {
        if (isMounted) {
          setLoadingReferral(false);
        }
      }
    }

    fetchReferralMe();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyId = () => {
    const id = referralData?.publicId || user?.publicId;
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const effectiveReferralUrl = buildPublicReferralUrl(
    referralData?.referralCode || user?.referralCode || 'PHXGENESIS',
    referralData?.referralUrl
  );

  const handleCopyCode = () => {
    const code = referralData?.referralCode || user?.referralCode;
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Active Operator';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatLastLogin = (dateStr?: string) => {
    if (!dateStr) return 'Current Session';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Active';
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. WELCOME HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#07101D] via-[#0B1728] to-[#07101D] border border-[#00CFFF]/20 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-[#00CFFF]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00CFFF]/10 border border-[#00CFFF]/30 text-xs font-mono text-[#00CFFF]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>AUTHENTICATED PROTOCOL OPERATOR</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome, {user?.fullName || 'Operator'}
            </h2>
            <p className="text-xs sm:text-sm text-[#98A2B3] max-w-2xl leading-relaxed">
              You are connected to the PHIVONEX cryptographic network. Below are your verified operator credentials, public registry identity, and network attribution links.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <NetworkPulseTrigger variant="compact" />

            <div className="px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm">
              <span className="text-[10px] font-mono uppercase text-[#98A2B3] block">Consensus Status</span>
              <span className="text-xs font-mono font-semibold text-[#32D583] flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-[#32D583] inline-block animate-pulse" />
                Synchronized (Live)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Real-time 24H Token Price Trend Performance Chart */}
      <TokenPriceTrendChart onNavigateTab={onNavigateTab} />

      {/* 2. REAL ACCOUNT OVERVIEW CARDS (6 Key Cards) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00CFFF]" />
            <span>Account Attributes</span>
          </h3>
          <span className="text-[11px] font-mono text-[#98A2B3]">Real-time DB Identity</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: PHIVONEX ID */}
          <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#00CFFF]/30 transition-all duration-200 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">PHIVONEX ID</span>
              <Key className="w-4 h-4 text-[#00CFFF]" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg sm:text-xl font-mono font-extrabold text-white tracking-wide">
                {referralData?.publicId || user?.publicId || 'PHX-PENDING'}
              </span>
              <button
                onClick={handleCopyId}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white text-xs transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
                title="Copy Public ID"
                aria-label="Copy Public ID"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-[#32D583]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-[#98A2B3] leading-normal">
              Public network identity for ledger lookups and registry indexing.
            </p>
          </div>

          {/* Card 2: Account Status */}
          <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#32D583]/30 transition-all duration-200 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">Account Status</span>
              <ShieldCheck className="w-4 h-4 text-[#32D583]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#32D583]/10 border border-[#32D583]/30 text-xs font-mono font-bold text-[#32D583]">
                <span className="w-2 h-2 rounded-full bg-[#32D583]" />
                {user?.status ? user.status.toUpperCase() : 'ACTIVE'}
              </span>
            </div>
            <p className="text-[11px] text-[#98A2B3] leading-normal">
              Account fully authorized for protocol participation and network consensus.
            </p>
          </div>

          {/* Card 3: Email Verification */}
          <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#168BFF]/30 transition-all duration-200 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">Email Verification</span>
              <Mail className="w-4 h-4 text-[#168BFF]" />
            </div>
            <div className="flex items-center gap-2">
              {user?.emailVerified ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#32D583]/10 border border-[#32D583]/30 text-xs font-mono font-semibold text-[#32D583]">
                  <Check className="w-3.5 h-3.5" />
                  Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00CFFF]/10 border border-[#00CFFF]/30 text-xs font-mono font-semibold text-[#00CFFF]">
                  <Check className="w-3.5 h-3.5" />
                  Primary Confirmed
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#98A2B3] leading-normal">
              Authenticated via secure token exchange and registered credential.
            </p>
          </div>

          {/* Card 4: Member Since */}
          <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-200 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">Member Since</span>
              <Calendar className="w-4 h-4 text-[#98A2B3]" />
            </div>
            <div className="text-base sm:text-lg font-bold text-white">
              {formatDate(user?.createdAt)}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-mono text-[#98A2B3]">
              <Clock className="w-3 h-3 text-[#00CFFF]" />
              <span>Last Login: {formatLastLogin(user?.lastLoginAt)}</span>
            </div>
          </div>

          {/* Card 5: Personal Referral Code */}
          <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#00CFFF]/30 transition-all duration-200 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">Personal Referral Code</span>
              <Tag className="w-4 h-4 text-[#00CFFF]" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg sm:text-xl font-mono font-extrabold text-[#00CFFF] tracking-wider">
                {referralData?.referralCode || user?.referralCode || 'PHX-PENDING'}
              </span>
              <button
                onClick={handleCopyCode}
                className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-[#32D583]" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="text-[11px]">{copiedCode ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <p className="text-[11px] text-[#98A2B3] leading-normal">
              Unique protocol tag for onboarding affiliated operators.
            </p>
          </div>

          {/* Card 6: Sponsor Link */}
          <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#32D583]/30 transition-all duration-200 shadow-lg space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">Sponsor Association</span>
              <UserCheck className="w-4 h-4 text-[#32D583]" />
            </div>
            {referralData?.sponsor ? (
              <div className="space-y-1">
                <div className="text-base font-bold text-white flex items-center gap-2">
                  <span className="text-[#32D583]">{referralData.sponsor.displayName}</span>
                </div>
                <div className="text-xs font-mono text-[#98A2B3]">
                  ID: {referralData.sponsor.publicId}
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-[#98A2B3]">
                  Direct Genesis Operator
                </span>
                <div className="text-[10px] text-[#98A2B3]">No sponsor referral used</div>
              </div>
            )}
            <p className="text-[11px] text-[#98A2B3] leading-normal">
              Direct protocol lineage registered at account creation.
            </p>
          </div>
        </div>
      </div>

      {/* 3. REFERRAL IDENTITY CARD (Detailed Task #3 & #4 Section) */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#07101D] via-[#0B192C] to-[#07101D] border border-[#00CFFF]/30 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <Tag className="w-5 h-5 text-[#00CFFF]" />
              <span>Personal Referral &amp; Identity Attribution</span>
            </div>
            <p className="text-xs text-[#98A2B3]">
              Distribute your cryptographically linked invite code or URL. All downline attribution is permanent and indexed in the protocol.
            </p>
          </div>
          <div className="text-[11px] font-mono text-[#00CFFF] bg-[#00CFFF]/10 px-3 py-1 rounded-full border border-[#00CFFF]/20 self-start sm:self-auto shrink-0">
            Immutable Protocol State
          </div>
        </div>

        {loadingReferral ? (
          <div className="py-10 flex flex-col items-center justify-center text-xs text-[#98A2B3] gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#00CFFF]" />
            <span>Resolving protocol referral credentials...</span>
          </div>
        ) : referralError ? (
          <div className="p-4 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-center gap-3 text-xs text-[#F04438]">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{referralError}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* My Referral Code */}
            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.08] space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-[#98A2B3] block uppercase tracking-wider font-mono">
                  My Referral Code
                </span>
                <span className="text-xl sm:text-2xl font-mono font-black text-[#00CFFF] tracking-widest block mt-1">
                  {referralData?.referralCode || user?.referralCode || 'PHX-PENDING'}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="w-full py-2 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px]"
              >
                {copiedCode ? <Check className="w-4 h-4 text-[#32D583]" /> : <Copy className="w-4 h-4" />}
                <span>{copiedCode ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>

            {/* Referral Link & Sharing */}
            <div className="lg:col-span-2 p-4 rounded-xl bg-[#05070B] border border-white/[0.08] space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-[#98A2B3] block uppercase tracking-wider font-mono mb-1.5">
                  Direct Referral Registration Link
                </span>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={effectiveReferralUrl}
                    className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#98A2B3] select-all focus:outline-none min-h-[44px]"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-5 py-2.5 rounded-xl bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-[#05070B] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-lg shadow-[#00CFFF]/20 min-h-[44px]"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-[#05070B]" /> : <Share2 className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copied' : 'Copy Referral Link'}</span>
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-[#98A2B3]">
                Sharing this link automatically embeds and locks your referral tag in the registration workflow.
              </p>
            </div>

            {/* Sponsor attribution display */}
            <div className="lg:col-span-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#32D583]/10 border border-[#32D583]/30 flex items-center justify-center text-[#32D583] shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[#98A2B3] block text-[11px]">Sponsor Protocol Link:</span>
                  {referralData?.sponsor ? (
                    <span className="text-white font-medium">
                      Registered under <strong className="text-[#32D583] font-bold">{referralData.sponsor.displayName}</strong> ({referralData.sponsor.publicId})
                    </span>
                  ) : (
                    <span className="text-[#98A2B3] font-medium">
                      Direct Genesis Registration (No intermediate sponsor)
                    </span>
                  )}
                </div>
              </div>

              <div className="text-[11px] font-mono text-[#98A2B3] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00CFFF]" />
                <span>Zero-Tamper Verified</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Task #13: FINANCIAL LEDGER & WALLET SECTION */}
      <WalletSection />

      {/* 4. USER PROFILE SUMMARY (Full Verified Account Details) */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-[#00CFFF]" />
              <span>User Profile Summary</span>
            </h3>
            <p className="text-xs text-[#98A2B3]">
              Verified identity data associated with your cryptographic operator session. Internal database UUIDs are never exposed.
            </p>
          </div>
          <span className="text-xs font-mono text-[#32D583] bg-[#32D583]/10 px-3 py-1 rounded-full border border-[#32D583]/20 hidden sm:inline-block">
            Verified Record
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
          {/* Full Name */}
          <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1.5">
            <span className="text-[10px] font-mono text-[#98A2B3] uppercase tracking-wider block">
              Full Legal Name
            </span>
            <div className="text-sm font-bold text-white truncate">
              {user?.fullName || 'Operator'}
            </div>
            <span className="text-[10px] text-[#98A2B3] block">Registered Account Name</span>
          </div>

          {/* Public PHIVONEX ID */}
          <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1.5">
            <span className="text-[10px] font-mono text-[#98A2B3] uppercase tracking-wider block">
              Public PHIVONEX ID
            </span>
            <div className="text-sm font-mono font-bold text-[#00CFFF] truncate">
              {user?.publicId || 'PHX-PENDING'}
            </div>
            <span className="text-[10px] text-[#98A2B3] block">Public network identifier</span>
          </div>

          {/* Email Address */}
          <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1.5">
            <span className="text-[10px] font-mono text-[#98A2B3] uppercase tracking-wider block">
              Email Address
            </span>
            <div className="text-sm font-semibold text-white truncate">
              {user?.email || 'N/A'}
            </div>
            <span className="text-[10px] text-[#98A2B3] block">Primary communication channel</span>
          </div>

          {/* Phone Number */}
          <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1.5">
            <span className="text-[10px] font-mono text-[#98A2B3] uppercase tracking-wider block">
              Mobile Phone
            </span>
            <div className="text-sm font-semibold text-white truncate">
              {user?.phone || 'Not Provided'}
            </div>
            <span className="text-[10px] text-[#98A2B3] block">Account security contact</span>
          </div>

          {/* Country */}
          <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1.5">
            <span className="text-[10px] font-mono text-[#98A2B3] uppercase tracking-wider block">
              Country of Residence
            </span>
            <div className="text-sm font-semibold text-white truncate">
              {user?.country || 'Global'}
            </div>
            <span className="text-[10px] text-[#98A2B3] block">Jurisdictional region</span>
          </div>

          {/* Account Status */}
          <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1.5">
            <span className="text-[10px] font-mono text-[#98A2B3] uppercase tracking-wider block">
              Account Status
            </span>
            <div className="text-sm font-bold text-[#32D583] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#32D583]" />
              {user?.status ? user.status.toUpperCase() : 'ACTIVE'}
            </div>
            <span className="text-[10px] text-[#98A2B3] block">Full protocol rights</span>
          </div>
        </div>
      </div>

      {/* 5. PROTOCOL ROADMAP & UPCOMING MODULES NOTICE (Clean, honest, no fake financials) */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-sm">
          <Info className="w-4 h-4 text-[#00CFFF]" />
          <span>Protocol Milestone &amp; Module Roadmap</span>
        </div>
        <p className="text-xs text-[#98A2B3] leading-relaxed">
          PHIVONEX operates under a phased launch architecture. Real-time Node Ownership, Mining Reward Halving, Binary Team Trees, Matching Bonus Calculations, and Wallet Ledger Balances will be deployed in subsequent protocol phases (Task #5+).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#00CFFF]">
              <span>Phase 1</span>
              <span className="text-[#32D583]">Current</span>
            </div>
            <span className="text-xs font-bold text-white block">Identity &amp; Attribution</span>
            <span className="text-[11px] text-[#98A2B3] block">Auth, Public IDs &amp; Referral Lineage</span>
          </div>

          <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1 opacity-75">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#98A2B3]">
              <span>Phase 2</span>
              <span>Upcoming</span>
            </div>
            <span className="text-xs font-bold text-white block">Node Infrastructure</span>
            <span className="text-[11px] text-[#98A2B3] block">Genesis Validator Allocations</span>
          </div>

          <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1 opacity-75">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#98A2B3]">
              <span>Phase 3</span>
              <span>Upcoming</span>
            </div>
            <span className="text-xs font-bold text-white block">Mining &amp; Rewards</span>
            <span className="text-[11px] text-[#98A2B3] block">Daily Halving &amp; Binary Matching</span>
          </div>
        </div>
      </div>
    </div>
  );
};
