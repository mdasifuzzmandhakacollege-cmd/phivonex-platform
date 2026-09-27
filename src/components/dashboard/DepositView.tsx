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
  Info,
  Layers,
  Search,
  Send,
  Loader2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { UserProfile } from '../../context/AuthContext';
import { UsdtIcon, BnbIcon, PhivoCoinIcon } from '../brand/CryptoIcons';

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

const DEFAULT_DEPOSIT_ADDRESS = '0x39F47C356d45eA49826a76C252794c4C83572D76';

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

  // Manual TxHash Verification State
  const [inputTxHash, setInputTxHash] = useState('');
  const [submittingTx, setSubmittingTx] = useState(false);
  const [txVerifySuccess, setTxVerifySuccess] = useState<string | null>(null);
  const [txVerifyError, setTxVerifyError] = useState<string | null>(null);

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

  const activeAddress = addressInfo?.address || DEFAULT_DEPOSIT_ADDRESS;

  // Handle Copy Address
  const handleCopy = () => {
    navigator.clipboard.writeText(activeAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Trigger Real-Time On-Chain Rescan
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
        setSuccessMessage('BNB Smart Chain listener synchronized. Latest transactions updated.');
        setTimeout(() => setSuccessMessage(null), 4000);
        await fetchData();
      } else {
        throw new Error(data.message || 'Rescan failed');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error during on-chain scan');
    } finally {
      setRescanning(false);
    }
  };

  // Submit on-chain Transaction Hash for instant verification
  const handleSubmitTxHash = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxVerifyError(null);
    setTxVerifySuccess(null);

    const cleanHash = inputTxHash.trim();
    if (!cleanHash) {
      setTxVerifyError('Please enter the transaction hash (TxHash / TxID) from your wallet or exchange.');
      return;
    }

    if (!/^0x[a-fA-F0-9]{64}$/.test(cleanHash)) {
      setTxVerifyError('Invalid TxHash format. Must be a 66-character hex string starting with 0x.');
      return;
    }

    try {
      setSubmittingTx(true);
      const res = await fetch('/api/deposits/submit-txhash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: cleanHash,
          asset: selectedAsset,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTxVerifySuccess(data.message || `Deposit verified and credited successfully!`);
        setInputTxHash('');
        await fetchData();
      } else {
        throw new Error(data.message || 'Transaction verification failed.');
      }
    } catch (err: any) {
      setTxVerifyError(err.message || 'Failed to verify transaction hash.');
    } finally {
      setSubmittingTx(false);
    }
  };

  const handlePasteTx = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputTxHash(text.trim());
      }
    } catch {
      // Ignore clipboard read errors
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
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B]">
                  BNB SMART CHAIN (BEP-20 / Native)
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Real-Time Listener Active
                </span>
              </div>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
              Blockchain Deposit Portal
            </h1>
            <p className="text-[#98A2B3] text-sm mt-1 max-w-xl">
              Deposit native BNB or BEP-20 USDT directly to your assigned protocol address on BNB Smart Chain. Incoming on-chain transfers are automatically detected and credited to your financial ledger in real-time.
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
              className="px-4 py-2.5 rounded-xl bg-[#F0B90B]/10 hover:bg-[#F0B90B]/20 border border-[#F0B90B]/30 text-[#F0B90B] text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Radio className={`w-4 h-4 ${rescanning ? 'animate-pulse text-[#F0B90B]' : ''}`} />
              {rescanning ? 'Scanning BNB Chain...' : 'Sync BNB Chain'}
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
            <p className="font-semibold text-emerald-200">Sync Complete</p>
            <p className="mt-0.5 text-emerald-300/90">{successMessage}</p>
          </div>
        </div>
      )}

      {/* 1. ASSET SELECTOR & NODE ACTIVATION INSTRUCTION BANNER */}
      <div className="p-6 rounded-2xl border border-white/[0.08] bg-[#07101D] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Coins className="w-5 h-5 text-[#F0B90B]" />
              Asset Selector (Deposit Currency)
            </h2>
            <p className="text-xs text-[#98A2B3] mt-0.5">
              Select your preferred deposit currency on BNB Smart Chain.
            </p>
          </div>

          {/* Dynamic Asset Selector Toggle */}
          <div className="inline-flex p-1.5 rounded-xl bg-black/40 border border-white/[0.08] shrink-0">
            <button
              onClick={() => handleAssetChange('BNB')}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isBnbSelected
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 scale-[1.02]'
                  : 'text-[#98A2B3] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <BnbIcon size={18} />
              <span>BNB Deposit</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${isBnbSelected ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-amber-500/20 text-amber-300'}`}>
                Native BNB
              </span>
            </button>

            <button
              onClick={() => handleAssetChange('USDT')}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                !isBnbSelected
                  ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25 scale-[1.02]'
                  : 'text-[#98A2B3] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <UsdtIcon size={18} />
              <span>USDT Deposit</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${!isBnbSelected ? 'bg-slate-950/20 text-slate-950 font-bold' : 'bg-emerald-500/20 text-emerald-300'}`}>
                BEP-20
              </span>
            </button>
          </div>
        </div>

        {/* Balance Separation & Node Activation Notice */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-[#F0B90B]/[0.08] via-[#00CFFF]/[0.05] to-transparent border border-[#F0B90B]/30 flex items-start gap-3.5">
          <Info className="w-5 h-5 text-[#F0B90B] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-white">
              BNB Smart Chain Integration &amp; Node Activation
            </p>
            <p className="text-[#98A2B3] leading-relaxed">
              Your <strong className="text-amber-300">BNB</strong> and <strong className="text-emerald-300">USDT (BEP-20)</strong> deposits are automatically detected on the BNB Smart Chain network. Either balance can be used directly to purchase and activate Genesis Nodes from the <button onClick={() => onNavigateTab?.('nodes')} className="text-[#00CFFF] underline hover:text-[#80EAFF] font-semibold">Buy Node</button> section.
            </p>
          </div>
        </div>
      </div>

      {/* 2. PRIMARY DEPOSIT CARD & QR DISPLAY SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Address Box */}
        <div className="lg:col-span-8 p-6 lg:p-8 rounded-2xl border border-white/[0.08] bg-[#07101D] space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {isBnbSelected ? <BnbIcon size={24} /> : <UsdtIcon size={24} />}
              <h2 className="text-lg font-bold text-white">
                Your Assigned {selectedAsset} Deposit Address
              </h2>
            </div>
            <span className="text-xs font-mono text-[#F0B90B] bg-[#F0B90B]/10 px-2.5 py-1 rounded-md border border-[#F0B90B]/20 font-semibold flex items-center gap-1.5">
              <BnbIcon size={14} />
              BNB Smart Chain (BEP-20)
            </span>
          </div>

          {/* Monospace Address Display */}
          <div className={`p-4 rounded-xl bg-black/50 border relative group transition-colors ${isBnbSelected ? 'border-amber-500/30' : 'border-emerald-500/30'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-mono text-[#98A2B3] uppercase tracking-wider block mb-1">
                  Recipient EVM Address ({addressInfo?.networkName || 'BNB Smart Chain'})
                </span>
                <p className={`font-mono text-sm sm:text-base md:text-lg font-semibold truncate select-all ${isBnbSelected ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {activeAddress}
                </p>
              </div>
              <button
                onClick={handleCopy}
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

          {/* Explorer Details */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-[#98A2B3] border-t border-white/[0.04]">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                Asset: <strong className={`font-mono ${isBnbSelected ? 'text-amber-300' : 'text-emerald-300'}`}>{selectedAsset}</strong>
              </span>
              <span>
                Network: <strong className="text-white font-mono">{addressInfo?.networkName || 'BNB Smart Chain'}</strong>
              </span>
              <span>
                Required Confirmations: <strong className="text-[#00CFFF] font-mono">{addressInfo?.requiredConfirmations || 3} Blocks</strong>
              </span>
            </div>
            <a
              href={addressInfo?.explorerUrl || `https://bscscan.com/address/${activeAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00CFFF] hover:text-[#80EAFF] flex items-center gap-1.5 transition-colors font-mono"
            >
              <span>View on BscScan</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Asset Specific Safety Card */}
          <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
            isBnbSelected
              ? 'bg-amber-500/[0.06] border-amber-500/20 text-amber-200'
              : 'bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-200'
          }`}>
            <ShieldCheck className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#F0B90B]" />
            <div className="space-y-1">
              <p className="font-semibold text-white">BNB Smart Chain Protocol Instructions</p>
              <p className="text-[#98A2B3]">
                {isBnbSelected
                  ? 'Send native BNB on BNB Smart Chain (BSC / BEP-20) only. Your transaction will be confirmed within 3 on-chain blocks and automatically credited to your balance.'
                  : 'Send BEP-20 USDT on BNB Smart Chain (BSC) only. Do not send via other networks. Deposits are detected automatically by the real-time node listener.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right: QR Code Visual Display */}
        <div className="lg:col-span-4 p-6 rounded-2xl border border-white/[0.08] bg-[#07101D] flex flex-col items-center justify-center text-center space-y-4">
          <div className="text-center space-y-1">
            <span className="text-xs font-mono text-[#F0B90B] font-semibold">QR SCAN</span>
            <h3 className="text-sm font-bold text-white">Scan with BNB Wallet</h3>
          </div>

          {/* QR Code Frame */}
          <div className="p-4 rounded-2xl bg-white shadow-2xl border border-white/20 inline-block">
            <QRCodeSVG
              value={activeAddress}
              size={160}
              bgColor="#FFFFFF"
              fgColor="#05070B"
              level="M"
              includeMargin={false}
            />
          </div>

          <p className="text-[11px] text-[#98A2B3] max-w-xs">
            Scan using <strong className="text-white">Binance App</strong>, <strong className="text-white">Trust Wallet</strong>, or <strong className="text-white">MetaMask</strong> on BNB Smart Chain.
          </p>
        </div>
      </div>

      {/* 2.5 INSTANT TXHASH VERIFICATION & CREDIT SECTION */}
      <div className="p-6 lg:p-8 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-[#0B1527] to-[#07101D] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F0B90B]/10 border border-[#F0B90B]/30 text-[#F0B90B]">
                INSTANT AUTO-CREDIT
              </span>
              <span className="text-xs text-[#98A2B3] font-mono">BNB Smart Chain (BEP-20)</span>
            </div>
            <h2 className="text-lg lg:text-xl font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-[#F0B90B]" />
              Submit Transaction Hash (TxHash / TxID)
            </h2>
            <p className="text-xs text-[#98A2B3] mt-1 max-w-2xl">
              Sent funds from your Binance, Trust Wallet, or MetaMask? Paste your on-chain transaction hash below. Our node listener will instantly verify the blockchain receipt and credit your balance within seconds.
            </p>
          </div>
        </div>

        {/* Verification Success / Error alerts */}
        {txVerifySuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-3 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-400" />
            <div className="text-xs">
              <p className="font-bold text-emerald-200">Deposit Verified &amp; Credited!</p>
              <p className="mt-0.5 text-emerald-300/90">{txVerifySuccess}</p>
            </div>
          </div>
        )}

        {txVerifyError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 animate-in fade-in">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
            <div className="text-xs">
              <p className="font-bold text-rose-200">Verification Alert</p>
              <p className="mt-0.5 text-rose-300/90">{txVerifyError}</p>
            </div>
          </div>
        )}

        {/* TxHash Input Form */}
        <form onSubmit={handleSubmitTxHash} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputTxHash}
                onChange={(e) => setInputTxHash(e.target.value)}
                placeholder="Paste transaction hash: 0x1234567890abcdef..."
                disabled={submittingTx}
                className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/[0.12] text-sm text-white placeholder-[#98A2B3]/60 font-mono focus:outline-none focus:border-[#F0B90B] transition-colors pr-24"
              />
              <button
                type="button"
                onClick={handlePasteTx}
                disabled={submittingTx}
                className="absolute right-2 top-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[#98A2B3] hover:text-white text-xs font-mono font-medium transition-all"
              >
                Paste
              </button>
            </div>

            <button
              type="submit"
              disabled={submittingTx || !inputTxHash.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#F0B90B] to-amber-500 hover:from-[#f5c52c] hover:to-amber-400 text-slate-950 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-lg shadow-amber-500/20 active:scale-95"
            >
              {submittingTx ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying on BSC...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Verify &amp; Credit Deposit</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-[#98A2B3] gap-2 pt-1">
            <span>
              Network: <strong className="text-white">BNB Smart Chain (Mainnet BSC)</strong>
            </span>
            <span>
              Target: <strong className={isBnbSelected ? 'text-amber-300' : 'text-emerald-300'}>{selectedAsset} Deposit</strong>
            </span>
            <span>
              Expected Confirmations: <strong className="text-white">3 Blocks</strong>
            </span>
          </div>
        </form>
      </div>

      {/* 3. DEPOSIT HISTORY & SUMMARY TABLE */}
      <div className="p-6 lg:p-8 rounded-2xl border border-white/[0.08] bg-[#07101D] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Deposit Transaction History</h2>
            <p className="text-xs text-[#98A2B3]">
              Real-time on-chain transfers on BNB Smart Chain detected and credited to your protocol ledger.
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
                className="pl-9 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white placeholder-[#98A2B3] focus:outline-none focus:border-[#F0B90B] w-48"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-black/40 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#F0B90B]"
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
                      Send {selectedAsset} on BNB Smart Chain to your assigned deposit address above. Incoming transfers appear here in real-time.
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
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] ${
                        dep.asset === 'BNB' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {dep.asset === 'BNB' ? <BnbIcon size={12} /> : <UsdtIcon size={12} />}
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
                        href={`https://bscscan.com/tx/${dep.txHash}`}
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
    </div>
  );
};
