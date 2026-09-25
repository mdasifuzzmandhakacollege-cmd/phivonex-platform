import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownLeft,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Coins,
  QrCode,
  Radio,
  Sparkles,
  Zap,
  Info,
  Layers,
  Search
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { UserProfile } from '../../context/AuthContext';

export type DepositAsset = 'BNB' | 'USDT';

interface DepositAddressInfo {
  address: string;
  chainId: number;
  asset: DepositAsset;
  networkName: string;
  requiredConfirmations: number;
  explorerUrl: string;
  derivationReference: string;
  warning: string;
  note?: string;
}

interface BlockchainDeposit {
  id: string;
  publicDepositId: string;
  userId: string;
  chainId: number;
  asset: DepositAsset;
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

export const DepositView: React.FC<DepositViewProps> = ({ user, onNavigateTab }) => {
  // Asset Selector State: 'BNB' or 'USDT'
  const [selectedAsset, setSelectedAsset] = useState<DepositAsset>('BNB');

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

  // Simulation Modal State
  const [showSimulateModal, setShowSimulateModal] = useState(false);
  const [simAsset, setSimAsset] = useState<DepositAsset>('BNB');
  const [simAmount, setSimAmount] = useState('100');
  const [simConfirmations, setSimConfirmations] = useState('3');
  const [simulating, setSimulating] = useState(false);

  // Fetch Deposit Address & Transaction History
  const fetchData = useCallback(async () => {
    try {
      setErrorMessage(null);

      // 1. Fetch Unique Deposit Address for Selected Asset
      const addrRes = await fetch(`/api/deposits/address?asset=${selectedAsset}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const addrData = await addrRes.json();

      if (addrRes.ok && addrData.success) {
        setAddressInfo(addrData.data);
      } else {
        throw new Error(addrData.message || `Failed to load ${selectedAsset} deposit address`);
      }

      // 2. Fetch User Deposits History
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
  }, [selectedAsset, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Asset Switch
  const handleAssetChange = (asset: DepositAsset) => {
    if (asset === selectedAsset) return;
    setSelectedAsset(asset);
    setLoading(true);
    setCopied(false);
  };

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

  // Trigger Simulated Deposit
  const handleSimulateDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSimulating(true);
      setErrorMessage(null);
      const res = await fetch('/api/deposits/simulate-test-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: simAsset,
          amount: parseFloat(simAmount),
          confirmations: parseInt(simConfirmations, 10),
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setShowSimulateModal(false);
        setSuccessMessage(`Simulated deposit of ${simAmount} ${simAsset} processed (${data.data?.status || 'CREDITED'}).`);
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

  // Filter deposits by search & asset
  const filteredDeposits = deposits.filter((dep) => {
    const matchesSearch = !searchQuery.trim() || (
      dep.publicDepositId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dep.txHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dep.fromAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dep.amount.toString().includes(searchQuery)
    );
    return matchesSearch;
  });

  const formatShortAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatShortTx = (tx: string) => {
    if (!tx || tx.length < 14) return tx;
    return `${tx.slice(0, 8)}...${tx.slice(-6)}`;
  };

  const isBnbSelected = selectedAsset === 'BNB';

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0A192F] to-[#07101D] p-6 lg:p-8">
        <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 transition-all duration-500 ${isBnbSelected ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`} />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2.5 rounded-xl border transition-all ${isBnbSelected ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                <ArrowDownLeft className="w-6 h-6" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                  BNB SMART CHAIN (BEP-20 / Native)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-[#00CFFF]/10 border border-[#00CFFF]/30 text-[#00CFFF] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00CFFF] animate-pulse" />
                  {addressInfo?.networkName || 'BSC Testnet (Chain 97)'}
                </span>
              </div>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Blockchain Deposit Portal
            </h1>
            <p className="text-[#98A2B3] text-sm mt-1 max-w-xl">
              Deposit native BNB or BEP-20 USDT directly to your assigned protocol deposit address. Incoming transfers are detected automatically on-chain and credited to your ledger.
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
              className="px-4 py-2.5 rounded-xl bg-[#00CFFF]/10 hover:bg-[#00CFFF]/20 border border-[#00CFFF]/30 text-[#00CFFF] text-sm font-medium flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Radio className={`w-4 h-4 ${rescanning ? 'animate-pulse text-[#00CFFF]' : ''}`} />
              {rescanning ? 'Scanning Chain...' : 'Rescan Chain'}
            </button>

            <button
              onClick={() => {
                setSimAsset(selectedAsset);
                setShowSimulateModal(true);
              }}
              className={`px-4 py-2.5 rounded-xl text-slate-950 text-sm font-semibold flex items-center gap-2 transition-all shadow-lg cursor-pointer ${
                isBnbSelected
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 shadow-amber-500/20'
                  : 'bg-gradient-to-r from-emerald-400 to-emerald-500 hover:brightness-110 shadow-emerald-500/20'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Simulate Deposit
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
            <p className="font-semibold text-emerald-200">Deposit Confirmed</p>
            <p className="mt-0.5 text-emerald-300/90">{successMessage}</p>
          </div>
        </div>
      )}

      {/* 1. ASSET SELECTOR & NODE ACTIVATION INSTRUCTION BANNER */}
      <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#07101D] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#00CFFF]" />
              Asset Selector (Deposit Currency)
            </h2>
            <p className="text-xs text-[#98A2B3] mt-0.5">
              Select your preferred deposit asset. Each asset generates a unique static address on BNB Smart Chain.
            </p>
          </div>

          {/* Dynamic Asset Selector Toggle */}
          <div className="inline-flex p-1.5 rounded-xl bg-black/40 border border-white/[0.08] shrink-0">
            <button
              onClick={() => handleAssetChange('BNB')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isBnbSelected
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 scale-[1.02]'
                  : 'text-[#98A2B3] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${isBnbSelected ? 'bg-slate-950' : 'bg-amber-400'}`} />
              <span>BNB Deposit</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isBnbSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-500/20 text-amber-300'}`}>
                Native
              </span>
            </button>

            <button
              onClick={() => handleAssetChange('USDT')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isBnbSelected
                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 scale-[1.02]'
                  : 'text-[#98A2B3] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${!isBnbSelected ? 'bg-slate-950' : 'bg-emerald-400'}`} />
              <span>USDT Deposit</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${!isBnbSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-emerald-500/20 text-emerald-300'}`}>
                BEP-20
              </span>
            </button>
          </div>
        </div>

        {/* Balance Separation & Node Activation Notice */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#00CFFF]/[0.08] via-[#0088FF]/[0.05] to-transparent border border-[#00CFFF]/30 flex items-start gap-3.5">
          <Info className="w-5 h-5 text-[#00CFFF] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-white">
              Independent Ledger Balances &amp; Direct Node Funding
            </p>
            <p className="text-[#98A2B3] leading-relaxed">
              Your <strong className="text-amber-300">BNB</strong> and <strong className="text-emerald-300">USDT</strong> deposit balances are tracked separately in your financial ledger. Either deposit balance can be used directly to purchase &amp; activate Genesis Nodes from the <button onClick={() => onNavigateTab?.('nodes')} className="text-[#00CFFF] underline hover:text-[#80EAFF] font-semibold">Buy Node</button> section.
            </p>
          </div>
        </div>
      </div>

      {/* 2. PRIMARY DEPOSIT CARD & QR DISPLAY SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Address Box */}
        <div className="lg:col-span-8 p-6 lg:p-8 rounded-2xl border border-white/[0.08] bg-[#07101D] space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className={`w-5 h-5 ${isBnbSelected ? 'text-amber-400' : 'text-emerald-400'}`} />
              <h2 className="text-lg font-bold text-white">
                Your Static {selectedAsset} Deposit Address
              </h2>
            </div>
            <span className="text-xs font-mono text-[#98A2B3] bg-black/40 px-2.5 py-1 rounded-md border border-white/[0.06]">
              Permanent Assigned Address
            </span>
          </div>

          {/* Monospace Address Display */}
          <div className={`p-4 rounded-xl bg-black/50 border relative group transition-colors ${isBnbSelected ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-mono text-[#98A2B3] uppercase tracking-wider block mb-1">
                  Recipient Address ({addressInfo?.networkName || 'BNB Smart Chain'})
                </span>
                <p className={`font-mono text-sm sm:text-base md:text-lg font-semibold truncate select-all ${isBnbSelected ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {loading ? 'Generating static address...' : addressInfo?.address || '0x0000000000000000000000000000000000000000'}
                </p>
              </div>
              <button
                onClick={handleCopy}
                disabled={loading || !addressInfo?.address}
                className={`px-4 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer flex-shrink-0 active:scale-95 ${
                  isBnbSelected
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-300'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
                }`}
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
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Asset: <strong className={`font-mono ${isBnbSelected ? 'text-amber-300' : 'text-emerald-300'}`}>{selectedAsset}</strong>
              </span>
              <span>
                Network: <strong className="text-white font-mono">{addressInfo?.networkName || 'BNB Smart Chain'}</strong>
              </span>
              <span>
                Confirmations: <strong className="text-[#00CFFF] font-mono">{addressInfo?.requiredConfirmations || 3} Blocks</strong>
              </span>
            </div>
            {addressInfo?.explorerUrl && (
              <a
                href={addressInfo.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00CFFF] hover:text-[#80EAFF] flex items-center gap-1.5 transition-colors font-mono"
              >
                <span>View on BscScan</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Asset Specific Warning Card */}
          <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
            isBnbSelected
              ? 'bg-amber-500/[0.06] border-amber-500/20 text-amber-200'
              : 'bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-200'
          }`}>
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#00CFFF]" />
            <div className="space-y-1">
              <p className="font-semibold text-white">Deposit Safety Guidelines</p>
              <p className="text-[#98A2B3]">
                {addressInfo?.warning || (isBnbSelected
                  ? 'Send native BNB on BNB Smart Chain (Chain ID: 97/56) only.'
                  : 'Send BEP-20 USDT on BNB Smart Chain only. Do not use TRC-20 or ERC-20 networks.')}
              </p>
            </div>
          </div>
        </div>

        {/* Right: QR Code Visual Display */}
        <div className="lg:col-span-4 p-6 rounded-2xl border border-white/[0.08] bg-[#07101D] flex flex-col items-center justify-center text-center space-y-4">
          <div className="text-center space-y-1">
            <span className="text-xs font-mono text-[#00CFFF] font-semibold">QR CODE SCAN</span>
            <h3 className="text-sm font-bold text-white">Scan with Web3 Wallet</h3>
          </div>

          {/* QR Code Frame */}
          <div className="p-4 rounded-2xl bg-white shadow-2xl border border-white/20 inline-block">
            {addressInfo?.address ? (
              <QRCodeSVG
                value={addressInfo.address}
                size={160}
                bgColor="#FFFFFF"
                fgColor="#05070B"
                level="M"
                includeMargin={false}
              />
            ) : (
              <div className="w-[160px] h-[160px] flex items-center justify-center bg-slate-100 text-slate-400 text-xs font-mono">
                Generating QR...
              </div>
            )}
          </div>

          <p className="text-[11px] text-[#98A2B3] max-w-xs">
            Scan to copy your static <strong className="text-white">{selectedAsset}</strong> deposit address in MetaMask, Trust Wallet, or Binance Web3 Wallet.
          </p>
        </div>
      </div>

      {/* 3. DEPOSIT HISTORY & SUMMARY TABLE */}
      <div className="p-6 lg:p-8 rounded-2xl border border-white/[0.08] bg-[#07101D] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Deposit Transaction History</h2>
            <p className="text-xs text-[#98A2B3]">
              Real-time on-chain transfers detected and credited to your protocol ledger.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search TX / ID / Address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white placeholder-[#98A2B3] focus:outline-none focus:border-[#00CFFF] w-48"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#00CFFF]"
            >
              <option value="ALL">All Statuses</option>
              <option value="CREDITED">Credited</option>
              <option value="CONFIRMING">Confirming</option>
              <option value="DETECTED">Detected</option>
            </select>
          </div>
        </div>

        {/* Deposit List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-[#98A2B3] uppercase font-mono tracking-wider">
                <th className="py-3 px-4">Deposit ID</th>
                <th className="py-3 px-4">Asset</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">From Address</th>
                <th className="py-3 px-4">TX Hash</th>
                <th className="py-3 px-4">Confirmations</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#98A2B3]">
                    Loading deposit history...
                  </td>
                </tr>
              ) : filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#98A2B3] space-y-2">
                    <Layers className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-semibold text-white">No deposits found</p>
                    <p className="text-xs max-w-sm mx-auto">
                      Send {selectedAsset} to your static deposit address above or click "Simulate Deposit" to test the automated flow.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDeposits.map((dep) => (
                  <tr key={dep.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-mono text-cyan-300 font-medium">
                      {dep.publicDepositId}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${
                        dep.asset === 'BNB' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {dep.asset || 'BNB'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-white text-sm">
                      +{dep.amount} {dep.asset || 'BNB'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#98A2B3]">
                      {formatShortAddress(dep.fromAddress)}
                    </td>
                    <td className="py-3.5 px-4 font-mono">
                      <a
                        href={`https://testnet.bscscan.com/tx/${dep.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#00CFFF] hover:underline flex items-center gap-1"
                      >
                        {formatShortTx(dep.txHash)}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[#98A2B3]">
                      {dep.confirmations} / {summary?.requiredConfirmations || 3}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-mono font-bold ${
                        dep.status === 'CREDITED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : dep.status === 'CONFIRMING'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      }`}>
                        {dep.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[#98A2B3] text-[11px]">
                      {new Date(dep.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SIMULATED TEST DEPOSIT MODAL */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-2xl bg-[#0B1528] border border-[#00CFFF]/40 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#00CFFF]" />
                <h3 className="text-base font-bold text-white">Simulate Blockchain Deposit</h3>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-[#98A2B3] hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateDeposit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#98A2B3] block mb-1">
                  Deposit Asset
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSimAsset('BNB')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      simAsset === 'BNB'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-black/30 border-white/[0.08] text-[#98A2B3]'
                    }`}
                  >
                    BNB (Native)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimAsset('USDT')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      simAsset === 'USDT'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-black/30 border-white/[0.08] text-[#98A2B3]'
                    }`}
                  >
                    USDT (BEP-20)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#98A2B3] block mb-1">
                  Amount ({simAsset})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/[0.1] text-sm text-white focus:outline-none focus:border-[#00CFFF] font-mono"
                  placeholder="e.g. 100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#98A2B3] block mb-1">
                  Simulated Block Confirmations
                </label>
                <select
                  value={simConfirmations}
                  onChange={(e) => setSimConfirmations(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/50 border border-white/[0.1] text-sm text-white focus:outline-none focus:border-[#00CFFF]"
                >
                  <option value="3">3 Blocks (Auto Confirmed &amp; Credited)</option>
                  <option value="1">1 Block (Confirming Status)</option>
                  <option value="0">0 Blocks (Detected Status)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-200">
                This triggers the automated listener pipeline to ingest the deposit event and update your ledger in real-time.
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={simulating}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#00CFFF] to-[#0088FF] text-xs font-bold text-slate-950 hover:brightness-110 shadow-lg shadow-[#00CFFF]/20 disabled:opacity-50"
                >
                  {simulating ? 'Processing...' : 'Run Simulation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
