import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownLeft,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Coins,
  QrCode,
  Radio,
  Layers,
  Search,
  Sparkles
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { UserProfile } from '../../context/AuthContext';

interface DepositAddressInfo {
  address: string;
  chainId: number;
  asset: string;
  networkName: string;
  requiredConfirmations: number;
  explorerUrl: string;
  derivationReference: string;
  warning: string;
}

interface BlockchainDeposit {
  id: string;
  publicDepositId: string;
  userId: string;
  chainId: number;
  asset: string;
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  blockNumber: number;
  confirmations: number;
  status: 'DETECTED' | 'CONFIRMING' | 'CONFIRMED' | 'CREDITED' | 'REORGED' | 'FAILED';
  detectedAt: string;
  confirmedAt: string | null;
  creditedAt: string | null;
  createdAt: string;
}

interface DepositSummary {
  totalCreditedBnb: number;
  totalPendingBnb: number;
  depositCount: number;
  requiredConfirmations: number;
  chainId: number;
  networkName: string;
}

interface DepositViewProps {
  user: UserProfile;
  onNavigateTab?: (tab: string) => void;
}

export const DepositView: React.FC<DepositViewProps> = ({ user }) => {
  const [addressInfo, setAddressInfo] = useState<DepositAddressInfo | null>(null);
  const [deposits, setDeposits] = useState<BlockchainDeposit[]>([]);
  const [summary, setSummary] = useState<DepositSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rescanning, setRescanning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Simulation state for testing/demo
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simAmount, setSimAmount] = useState('0.5');
  const [simConfirmations, setSimConfirmations] = useState('3');
  const [simulating, setSimulating] = useState(false);

  // Fetch address & deposit history
  const fetchData = useCallback(async () => {
    try {
      setErrorMessage(null);

      // 1. Fetch Deposit Address
      const addrRes = await fetch('/api/deposits/address', {
        headers: { 'Content-Type': 'application/json' },
      });
      const addrData = await addrRes.json();

      if (addrRes.ok && addrData.success) {
        setAddressInfo(addrData.data);
      } else {
        throw new Error(addrData.message || 'Failed to load deposit address');
      }

      // 2. Fetch Deposits History
      const filterParam = statusFilter !== 'ALL' ? `&status=${statusFilter}` : '';
      const depRes = await fetch(`/api/deposits/me?page=1&limit=50${filterParam}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const depData = await depRes.json();

      if (depRes.ok && depData.success) {
        setDeposits(depData.data.deposits || []);
        setSummary(depData.data.summary || null);
      }
    } catch (err: any) {
      console.error('[DepositView] Error fetching data:', err);
      setErrorMessage(err?.message || 'Unable to communicate with the BNB Smart Chain service.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Copy Address
  const handleCopy = () => {
    if (!addressInfo?.address) return;
    navigator.clipboard.writeText(addressInfo.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Trigger On-Chain Rescan
  const handleRescan = async () => {
    try {
      setRescanning(true);
      setErrorMessage(null);
      const res = await fetch('/api/deposits/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage('On-chain scan completed. Deposit statuses updated.');
        setTimeout(() => setSuccessMessage(null), 4000);
        await fetchData();
      } else {
        throw new Error(data.message || 'Rescan failed');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error during on-chain rescan');
    } finally {
      setRescanning(false);
    }
  };

  // Trigger Test Deposit Simulation
  const handleSimulateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSimulating(true);
      setErrorMessage(null);
      const res = await fetch('/api/deposits/simulate-test-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(simAmount),
          confirmations: parseInt(simConfirmations, 10),
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setShowSimulateModal(false);
        setSuccessMessage(`Simulated deposit of ${simAmount} BNB processed (${data.data?.status || 'UPDATED'}).`);
        setTimeout(() => setSuccessMessage(null), 4000);
        await fetchData();
      } else {
        throw new Error(data.message || 'Simulation failed');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Simulation error');
    } finally {
      setSimulating(false);
    }
  };

  // Filter deposits by search
  const filteredDeposits = deposits.filter((dep) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      dep.publicDepositId.toLowerCase().includes(q) ||
      dep.txHash.toLowerCase().includes(q) ||
      dep.fromAddress.toLowerCase().includes(q) ||
      dep.amount.toString().includes(q)
    );
  });

  const formatShortAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatShortTx = (tx: string) => {
    if (!tx || tx.length < 14) return tx;
    return `${tx.slice(0, 8)}...${tx.slice(-6)}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0A192F] to-[#07101D] p-6 lg:p-8">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <ArrowDownLeft className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                  BNB SMART CHAIN
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  {addressInfo?.networkName || 'BSC Testnet (Chain 97)'}
                </span>
              </div>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Automatic BNB Deposits
            </h1>
            <p className="text-[#98A2B3] text-sm mt-1 max-w-xl">
              Send native BNB to your personal assigned protocol address. The automated listener detects transfers on-chain and credits your ledger balance after confirmation.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setRefreshing(true);
                fetchData();
              }}
              disabled={loading || refreshing}
              className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white text-sm font-medium flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleRescan}
              disabled={rescanning || loading}
              className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-medium flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Radio className={`w-4 h-4 ${rescanning ? 'animate-pulse text-amber-400' : ''}`} />
              {rescanning ? 'Scanning Chain...' : 'Rescan Chain'}
            </button>

            <button
              onClick={() => setShowSimulateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Test Deposit
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
          <div className="text-sm">
            <p className="font-semibold text-rose-200">Deposit Alert</p>
            <p className="mt-0.5 text-rose-300/90">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-200">Success</p>
            <p className="mt-0.5 text-emerald-300/90">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Primary Deposit Card & QR Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Address Box */}
        <div className="lg:col-span-8 p-6 lg:p-8 rounded-2xl border border-white/[0.08] bg-[#07101D] space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold text-white">Your Personal BNB Deposit Address</h2>
            </div>
            <span className="text-xs font-mono text-[#98A2B3]">
              1 Address Per Account
            </span>
          </div>

          {/* Monospace Address Display */}
          <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20 relative group">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-mono text-[#98A2B3] uppercase tracking-wider block mb-1">
                  Recipient Address (BSC {addressInfo?.chainId || 97})
                </span>
                <p className="font-mono text-sm sm:text-base md:text-lg text-amber-300 font-semibold truncate select-all">
                  {addressInfo?.address || 'Deriving personal address...'}
                </p>
              </div>
              <button
                onClick={handleCopy}
                disabled={!addressInfo?.address}
                className="px-4 py-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 font-medium text-sm flex items-center gap-2 transition-all cursor-pointer flex-shrink-0 active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Address</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Derivation & Explorer Details */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-[#98A2B3] border-t border-white/[0.04]">
            <div className="flex items-center gap-4">
              <span>
                Asset: <strong className="text-white font-mono">BNB</strong>
              </span>
              <span>
                Network: <strong className="text-white font-mono">{addressInfo?.networkName || 'BNB Smart Chain'}</strong>
              </span>
              <span>
                Required Confirmations: <strong className="text-amber-400 font-mono">{addressInfo?.requiredConfirmations || 3} Blocks</strong>
              </span>
            </div>
            {addressInfo?.explorerUrl && (
              <a
                href={addressInfo.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 transition-colors font-mono"
              >
                View on BscScan
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Mandatory Safety Warning Banner */}
          <div className="p-4 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 text-amber-300 text-xs leading-relaxed flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-semibold text-amber-200 uppercase tracking-wide">
                Strict Deposit Rules
              </p>
              <p className="mt-1 text-amber-300/90">
                Send <strong>native BNB</strong> on the configured <strong>BNB Smart Chain (Chain ID: {addressInfo?.chainId || 97})</strong> only. Do not transfer BEP-20 tokens, USDT, or tokens from other blockchains (Ethereum, Polygon, Arbitrum). Funds will automatically be credited in native BNB to your financial ledger once {addressInfo?.requiredConfirmations || 3} block confirmations are reached.
              </p>
            </div>
          </div>
        </div>

        {/* Right: Real QR Code Container */}
        <div className="lg:col-span-4 p-6 lg:p-8 rounded-2xl border border-white/[0.08] bg-[#07101D] flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 rounded-xl bg-white p-3 shadow-xl inline-block">
            {addressInfo?.address ? (
              <QRCodeSVG
                value={addressInfo.address}
                size={160}
                level="M"
                includeMargin={false}
              />
            ) : (
              <div className="w-40 h-40 bg-slate-200 animate-pulse rounded flex items-center justify-center text-slate-400 text-xs">
                Generating QR...
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Scan with Mobile Wallet</p>
            <p className="text-xs text-[#98A2B3] mt-0.5">Trust Wallet, MetaMask, Binance App</p>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#07101D] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#98A2B3] font-mono">
            <span>TOTAL CREDITED</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {(summary?.totalCreditedBnb || 0).toFixed(4)} <span className="text-sm font-normal text-amber-400">BNB</span>
          </p>
          <p className="text-xs text-emerald-400/90 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Settled in Financial Ledger
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#07101D] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#98A2B3] font-mono">
            <span>PENDING CONFIRMATIONS</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400 font-mono">
            {(summary?.totalPendingBnb || 0).toFixed(4)} <span className="text-sm font-normal text-amber-400">BNB</span>
          </p>
          <p className="text-xs text-[#98A2B3] flex items-center gap-1 mt-1">
            <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            Awaiting required block depth
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#07101D] space-y-1">
          <div className="flex items-center justify-between text-xs text-[#98A2B3] font-mono">
            <span>TOTAL DEPOSITS</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {summary?.depositCount || deposits.length} <span className="text-sm font-normal text-[#98A2B3]">Transactions</span>
          </p>
          <p className="text-xs text-cyan-400/90 flex items-center gap-1 mt-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            Zero-loss reorg protected
          </p>
        </div>
      </div>

      {/* Deposit History Section */}
      <div className="p-6 lg:p-8 rounded-2xl border border-white/[0.08] bg-[#07101D] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Deposit Transaction Log</h2>
            <p className="text-xs text-[#98A2B3] mt-0.5">Real-time status tracking and block confirmations</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tx hash or ID..."
                className="pl-9 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.08] text-xs text-white placeholder-[#98A2B3] focus:outline-none focus:border-amber-500/50 w-48 sm:w-60"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center rounded-lg bg-black/40 p-1 border border-white/[0.08] text-xs">
              {['ALL', 'CONFIRMING', 'CREDITED', 'REORGED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-md transition-colors font-medium cursor-pointer ${
                    statusFilter === status
                      ? 'bg-amber-500/20 text-amber-300 font-semibold'
                      : 'text-[#98A2B3] hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Deposit Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] text-[#98A2B3] font-mono uppercase tracking-wider">
                <th className="pb-3 pr-4">Deposit ID</th>
                <th className="pb-3 pr-4">TX Hash</th>
                <th className="pb-3 pr-4">Amount</th>
                <th className="pb-3 pr-4">From</th>
                <th className="pb-3 pr-4">Confirmations</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 text-right">Detected At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-white">
              {filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#98A2B3]">
                    <ArrowDownLeft className="w-8 h-8 mx-auto mb-2 text-white/20" />
                    <p className="font-medium text-sm text-white">No deposits recorded yet</p>
                    <p className="text-xs text-[#98A2B3] mt-1">
                      Send native BNB to your address above to initiate your first automatic deposit.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDeposits.map((dep) => {
                  const reqConfs = addressInfo?.requiredConfirmations || 3;
                  const isMature = dep.confirmations >= reqConfs;

                  return (
                    <tr key={dep.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 pr-4 font-mono font-semibold text-amber-300">
                        {dep.publicDepositId}
                      </td>
                      <td className="py-4 pr-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-cyan-300">{formatShortTx(dep.txHash)}</span>
                          <a
                            href={`${addressInfo?.explorerUrl ? addressInfo.explorerUrl.replace('/address/', '/tx/') : 'https://testnet.bscscan.com/tx/'}${dep.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#98A2B3] hover:text-white transition-colors"
                            title="View on BscScan"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </td>
                      <td className="py-4 pr-4 font-mono font-bold text-white text-sm">
                        {dep.amount.toFixed(4)} <span className="text-amber-400 text-xs font-normal">BNB</span>
                      </td>
                      <td className="py-4 pr-4 font-mono text-[#98A2B3]">
                        {formatShortAddress(dep.fromAddress)}
                      </td>
                      <td className="py-4 pr-4 font-mono">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                isMature ? 'bg-emerald-400' : 'bg-amber-400'
                              }`}
                              style={{
                                width: `${Math.min(100, (dep.confirmations / reqConfs) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className={isMature ? 'text-emerald-400 font-semibold' : 'text-amber-300'}>
                            {dep.confirmations} / {reqConfs}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        {dep.status === 'CREDITED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" />
                            CREDITED
                          </span>
                        )}
                        {dep.status === 'CONFIRMED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                            <ShieldCheck className="w-3 h-3" />
                            CONFIRMED
                          </span>
                        )}
                        {(dep.status === 'CONFIRMING' || dep.status === 'DETECTED') && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            {dep.status}
                          </span>
                        )}
                        {dep.status === 'REORGED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-purple-500/10 border border-purple-500/30 text-purple-300">
                            <AlertTriangle className="w-3 h-3" />
                            REORGED
                          </span>
                        )}
                        {dep.status === 'FAILED' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-rose-500/10 border border-rose-500/30 text-rose-300">
                            <XCircle className="w-3 h-3" />
                            FAILED
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-right font-mono text-[#98A2B3]">
                        {new Date(dep.detectedAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulated Deposit Modal (For Testnet & Integration Testing) */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl border border-white/[0.08] bg-[#07101D] shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">Simulate Testnet Deposit</h3>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="p-1 rounded-lg text-[#98A2B3] hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#98A2B3]">
              Simulate an incoming BNB Smart Chain transaction to test deposit listener detection, block confirmation progression, and automatic ledger crediting.
            </p>

            <form onSubmit={handleSimulateDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-[#98A2B3] uppercase mb-1">
                  Deposit Amount (BNB)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-sm focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-[#98A2B3] uppercase mb-1">
                  Initial Confirmations
                </label>
                <select
                  value={simConfirmations}
                  onChange={(e) => setSimConfirmations(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/[0.08] text-white font-mono text-sm focus:outline-none focus:border-amber-500/50"
                >
                  <option value="1">1 Confirmation (CONFIRMING - Not Credited)</option>
                  <option value="2">2 Confirmations (CONFIRMING - Not Credited)</option>
                  <option value="3">3 Confirmations (CONFIRMED → Auto Credited)</option>
                  <option value="10">10 Confirmations (Deeply Finalized)</option>
                </select>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                Simulated destination address: <span className="font-mono">{formatShortAddress(addressInfo?.address || '')}</span>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
                >
                  {simulating ? 'Broadcasting...' : 'Simulate Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
