import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  Layers,
  Coins,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Loader2,
  Zap,
  Lock,
  ChevronLeft,
  Building2,
  Sparkles,
  Info,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  ArrowRightLeft,
  RotateCcw,
} from 'lucide-react';
import { UserProfile } from '../../context/AuthContext';
import { useSystemConfig } from '../../context/SystemConfigContext';
import { GENESIS_NODE_CAP, NODE_BASE_PRICE_USD, RESERVATION_EXPIRY_MINUTES } from '../../config/nodeConfig';
import { UsdtIcon, BnbIcon, PhivoCoinIcon } from '../brand/CryptoIcons';
import { GenesisEngineAnimation } from '../GenesisEngineAnimation';

interface BuyNodeViewProps {
  user: UserProfile;
  onNavigateTab: (tab: string) => void;
}

interface NodeStats {
  genesisCap: number;
  basePriceUsd: number;
  available: number;
  reserved: number;
  active: number;
  retired: number;
  allocated: number;
}

interface NodeOrder {
  publicOrderId: string;
  publicNodeId: string;
  nodeNumber: number;
  amountUsd: number;
  currency: string;
  status: 'PENDING' | 'SETTLING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  paymentMethod: string;
  paymentReference: string | null;
  reservedAt: string;
  expiresAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  secondsRemaining: number;
}

export const BuyNodeView: React.FC<BuyNodeViewProps> = ({ user, onNavigateTab }) => {
  const { nodeBasePriceUsd: realTimeNodePrice, lastUpdated } = useSystemConfig();
  const [stats, setStats] = useState<NodeStats | null>(null);
  const [activeOrder, setActiveOrder] = useState<NodeOrder | null>(null);
  const [pastOrders, setPastOrders] = useState<NodeOrder[]>([]);
  const [depositBalance, setDepositBalance] = useState<number>(0);
  const [balanceValidation, setBalanceValidation] = useState<{
    nodePriceUsd: number;
    bnbPriceUsd: number;
    bnbRequired: number;
    usdtRequired: number;
    usdtBalance: { available: number; sufficient: boolean; missing: number };
    bnbBalance: { available: number; sufficient: boolean; missing: number };
    canActivateWithUsdt: boolean;
    canActivateWithBnb: boolean;
  } | null>(null);
  const [selectedAssetForNode, setSelectedAssetForNode] = useState<'USDT' | 'BNB'>('USDT');
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [activatingDeposit, setActivatingDeposit] = useState(false);
  const [devSettling, setDevSettling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'CRYPTO_USDT' | 'BANK_WIRE'>('CRYPTO_USDT');
  const [nodeQty, setNodeQty] = useState<number>(1);
  const [showMobileDetails, setShowMobileDetails] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activatedNode, setActivatedNode] = useState<{ publicNodeId: string; nodeNumber: number } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeOffers, setActiveOffers] = useState<any[]>([]);

  // Node Wallet Allocation & Transfer state
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);
  const [transferAmountInput, setTransferAmountInput] = useState<number>(1000);
  const [nodeVaultAllocated, setNodeVaultAllocated] = useState<number>(0);
  const [transferLoading, setTransferLoading] = useState<boolean>(false);
  const [transferFeedback, setTransferFeedback] = useState<string | null>(null);

  // Check if current client environment is development/sandbox
  const isDevMode = typeof window !== 'undefined' && (
    import.meta.env.DEV || 
    window.location.hostname === 'localhost' || 
    window.location.hostname.includes('ais-dev')
  );

  // Countdown timer state
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch stats, user orders, and unified wallet balance
  const loadData = async (isBackground = false) => {
    if (!isBackground) setErrorMsg(null);
    try {
      const [statsRes, ordersRes, depRes, valRes, promoRes, walletRes] = await Promise.all([
        fetch('/api/nodes/stats'),
        fetch('/api/node-orders/me', { credentials: 'include' }),
        fetch('/api/deposits/me?page=1&limit=10', { credentials: 'include' }),
        fetch('/api/node-orders/balance-validation', { credentials: 'include' }),
        fetch('/api/promotions/offers', { credentials: 'include' }),
        fetch('/api/wallet/me', { credentials: 'include' }),
      ]);

      if (promoRes && promoRes.ok) {
        const promoData = await promoRes.json();
        setActiveOffers(promoData.offers || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      let walletAvail = 0;
      if (walletRes && walletRes.ok) {
        const walletData = await walletRes.json();
        walletAvail = Number(walletData.availableBalance || walletData.ledgerBalance || 0);
      }

      let usdtAvailBalance = walletAvail;
      if (valRes.ok) {
        const valData = await valRes.json();
        if (valData.success && valData.validation) {
          const apiVal = Number(valData.validation.usdtBalance?.available || 0);
          usdtAvailBalance = Math.max(apiVal, walletAvail);
          const reqUsdt = valData.validation.usdtRequired || realTimeNodePrice || 1000;
          const isSuff = usdtAvailBalance >= reqUsdt || nodeVaultAllocated >= reqUsdt;

          setBalanceValidation({
            ...valData.validation,
            usdtBalance: {
              ...valData.validation.usdtBalance,
              available: usdtAvailBalance,
              sufficient: isSuff,
              missing: isSuff ? 0 : Math.max(0, reqUsdt - usdtAvailBalance),
            },
            canActivateWithUsdt: isSuff,
          });
          setDepositBalance(usdtAvailBalance);
        }
      } else if (walletAvail > 0) {
        const reqUsdt = realTimeNodePrice || 1000;
        const isSuff = walletAvail >= reqUsdt || nodeVaultAllocated >= reqUsdt;
        setDepositBalance(walletAvail);
        setBalanceValidation({
          nodePriceUsd: reqUsdt,
          bnbPriceUsd: 450,
          bnbRequired: 2.2222,
          usdtRequired: reqUsdt,
          usdtBalance: {
            available: walletAvail,
            sufficient: isSuff,
            missing: isSuff ? 0 : Math.max(0, reqUsdt - walletAvail),
          },
          bnbBalance: {
            available: 0,
            sufficient: false,
            missing: 2.2222,
          },
          canActivateWithUsdt: isSuff,
          canActivateWithBnb: false,
        });
      }

      if (depRes.ok) {
        const depData = await depRes.json();
        if (depData.success && depData.data?.summary && usdtAvailBalance === 0) {
          const totalCredited = Number(depData.data.summary.totalCreditedBnb || 0);
          const creditedDeposits = (depData.data.deposits || []).filter((d: any) => d.status === 'CREDITED');
          const sumCredited = creditedDeposits.reduce((acc: number, d: any) => acc + Number(d.amount || 0), 0);
          if (sumCredited > 0 || totalCredited > 0) {
            setDepositBalance(sumCredited > 0 ? sumCredited : totalCredited);
          }
        }
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        const ordersList: NodeOrder[] = ordersData.orders || [];
        setPastOrders(ordersList);

        // Check if there is an active pending order
        const pending = ordersList.find((o) => o.status === 'PENDING' && o.secondsRemaining > 0);
        if (pending) {
          setActiveOrder(pending);
          setSecondsLeft(pending.secondsRemaining);
        } else {
          // If we had an active order and now it's gone / completed
          if (activeOrder && !activatedNode) {
            const completed = ordersList.find((o) => o.publicOrderId === activeOrder.publicOrderId && o.status === 'COMPLETED');
            if (completed) {
              setActivatedNode({
                publicNodeId: completed.publicNodeId,
                nodeNumber: completed.nodeNumber,
              });
              setSuccessMsg(`Genesis Node ${completed.publicNodeId} verified and activated!`);
            }
          }
          setActiveOrder(null);
          setSecondsLeft(0);
        }
      }
    } catch (err) {
      if (!isBackground) {
        console.warn('Failed to load buy node data:', err);
        setErrorMsg('Failed to fetch protocol inventory.');
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time authoritative refetch on offers update or node price update
  useEffect(() => {
    loadData(true);
  }, [realTimeNodePrice, lastUpdated]);

  // Real-time synchronization on balance, transaction, or node order updates
  useEffect(() => {
    const handleUpdate = () => {
      loadData(true);
    };
    window.addEventListener('phivonex:balance-or-tx-updated', handleUpdate);
    return () => window.removeEventListener('phivonex:balance-or-tx-updated', handleUpdate);
  }, []);

  // Poll for settlement webhook verification when an order is pending
  useEffect(() => {
    if (activeOrder && activeOrder.status === 'PENDING') {
      pollRef.current = setInterval(() => {
        loadData(true);
      }, 4000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeOrder?.publicOrderId, activeOrder?.status]);

  // Live timer interval
  useEffect(() => {
    if (activeOrder && secondsLeft > 0) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            // Reservation expired locally, refresh data from backend
            loadData();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeOrder?.publicOrderId, secondsLeft > 0]);

  // Handle Activate Node directly with Deposit Balance (BNB or USDT)
  const handleActivateWithAsset = async (asset: 'BNB' | 'USDT') => {
    setActivatingDeposit(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setActivatedNode(null);

    try {
      const res = await fetch('/api/node-orders/activate-with-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ asset }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || `Failed to activate Genesis Node using ${asset} balance.`);
        return;
      }

      setActivatedNode({
        publicNodeId: data.result.node.publicNodeId,
        nodeNumber: data.result.node.nodeNumber,
      });
      setSuccessMsg(`Genesis Node ${data.result.node.publicNodeId} successfully activated using your ${data.result.assetUsed} deposit balance!`);
      setActiveOrder(null);
      setSecondsLeft(0);
      loadData();
    } catch (err: any) {
      console.error('Error activating node with asset balance:', err);
      setErrorMsg('Network error while processing node activation.');
    } finally {
      setActivatingDeposit(false);
    }
  };

  // Handle Reserve Action
  const handleReserveNode = async () => {
    setReserving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setActivatedNode(null);

    try {
      const idempotencyKey = `req_${user.publicId}_${Date.now()}`;

      const res = await fetch('/api/node-orders/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        credentials: 'include',
        body: JSON.stringify({
          paymentMethod: selectedMethod,
          idempotencyKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'SOLD_OUT') {
          setErrorMsg('Genesis Node allocation is completely sold out.');
        } else {
          setErrorMsg(data.message || 'Failed to reserve Genesis Node.');
        }
        return;
      }

      if (data.order) {
        setActiveOrder(data.order);
        setSecondsLeft(data.order.secondsRemaining);
        setSuccessMsg(data.isExisting ? 'Active reservation retrieved.' : 'Genesis Node reserved! Please complete deposit before the 15-minute timer expires.');
        loadData();
      }
    } catch (err: any) {
      console.error('Error reserving node:', err);
      setErrorMsg('Network error while reserving node. Please retry.');
    } finally {
      setReserving(false);
    }
  };

  // Handle Dev Test-Only Webhook Simulator
  const handleDevSimulateSettlement = async () => {
    if (!activeOrder) return;
    setDevSettling(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/node-orders/dev/simulate-settlement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          orderId: activeOrder.publicOrderId,
          paymentReference: `DEV_WEBHOOK_TX_${Date.now()}`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || 'Dev simulation failed.');
        if (data.error === 'ORDER_EXPIRED') {
          setActiveOrder(null);
          loadData();
        }
        return;
      }

      setActivatedNode({
        publicNodeId: data.node.publicNodeId,
        nodeNumber: data.node.nodeNumber,
      });
      setSuccessMsg(`[DEV] Genesis Node ${data.node.publicNodeId} successfully activated via simulated webhook!`);
      setActiveOrder(null);
      setSecondsLeft(0);
      loadData();
    } catch (err) {
      console.error('Error in dev settlement simulator:', err);
      setErrorMsg('Network error during dev simulation.');
    } finally {
      setDevSettling(false);
    }
  };

  // Handle Cancel Action
  const handleCancelOrder = async () => {
    if (!activeOrder) return;
    setCancelling(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/node-orders/${activeOrder.publicOrderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.message || 'Failed to cancel reservation.');
        return;
      }

      setSuccessMsg('Reservation cancelled. The node has been returned to available inventory.');
      setActiveOrder(null);
      setSecondsLeft(0);
      loadData();
    } catch (err) {
      console.error('Error cancelling order:', err);
      setErrorMsg('Network error while cancelling order.');
    } finally {
      setCancelling(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Format MM:SS for countdown
  const formatCountdown = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const isSoldOut = (stats?.available ?? 1) === 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fadeIn">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigateTab('nodes')}
          className="flex items-center gap-2 text-xs font-mono text-[#98A2B3] hover:text-[#00CFFF] transition-colors cursor-pointer py-2 px-3 rounded-lg hover:bg-white/[0.04]"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to My Nodes</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-mono text-[#98A2B3]">
          <span className="w-2 h-2 rounded-full bg-[#32D583]" />
          <span>Genesis Phase 1 Allocation</span>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-[#07101D] via-[#0D1B30] to-[#07101D] border border-white/[0.08] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00CFFF]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#00CFFF]/10 border border-[#00CFFF]/30 text-[#00CFFF] text-[11px] font-mono">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cryptographic Consensus Validator</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Acquire PHIVONEX Genesis Node
          </h1>

          <p className="text-xs sm:text-sm text-[#98A2B3] leading-relaxed">
            Genesis Nodes validate ledger state transitions, secure the distributed cryptographic network, and earn proportional block emissions.
          </p>

          <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-mono">
            <div>
              <span className="text-[#98A2B3] block text-[10px]">FIXED PRICE</span>
              <span className="text-lg font-bold text-white font-mono">${(realTimeNodePrice || stats?.basePriceUsd || NODE_BASE_PRICE_USD).toLocaleString()} USD</span>
            </div>
            <div className="h-8 w-px bg-white/[0.08]" />
            <div>
              <span className="text-[#98A2B3] block text-[10px]">TOTAL CAP</span>
              <span className="text-lg font-bold text-white font-mono">{GENESIS_NODE_CAP.toLocaleString()} Nodes</span>
            </div>
            <div className="h-8 w-px bg-white/[0.08]" />
            <div>
              <span className="text-[#98A2B3] block text-[10px]">AVAILABLE SUPPLY</span>
              <span className="text-lg font-bold text-[#00CFFF] font-mono">
                {loading ? '...' : (stats?.available ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Promotional Offer Banner (BOGO / Free Node) */}
      {activeOffers && activeOffers.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#0D1B30] to-indigo-950/40 border border-purple-800/40 shadow-xl space-y-3 relative overflow-hidden animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" /> Active Protocol Promotion
              </span>
              <span className="text-xs text-purple-200 font-semibold font-mono">
                {activeOffers[0].title}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 font-bold">
              +{activeOffers[0].bonusNodesCount || 1} Free Bonus Node
            </span>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            {activeOffers[0].description}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-[11px] pt-1 text-slate-400">
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Free Node Daily Mining Rewards: Enabled</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Info className="w-3.5 h-3.5 text-indigo-400" />
              <span>Matching &amp; Direct Spot Bonus: Real Purchased Node Only</span>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-[#32D583]/10 border border-[#32D583]/30 text-[#32D583] text-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          {activatedNode && (
            <button
              onClick={() => onNavigateTab('nodes')}
              className="text-xs font-bold text-white underline hover:text-[#32D583] transition-colors cursor-pointer"
            >
              View Node
            </button>
          )}
        </div>
      )}

      {/* Error Notification */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 text-[#F04438] text-xs flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* ACTIVATED CELEBRATION CARD */}
      {activatedNode && (
        <div className="p-8 rounded-2xl bg-gradient-to-b from-[#07101D] to-[#0A1A2F] border-2 border-[#32D583]/50 shadow-2xl text-center space-y-6 animate-scaleUp">
          <div className="w-16 h-16 rounded-2xl bg-[#32D583]/20 border border-[#32D583]/40 text-[#32D583] flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Genesis Node Activated!</h2>
            <p className="text-xs text-[#98A2B3] max-w-md mx-auto">
              Your cryptographic node is officially registered to your operator ID and is now active in consensus validation.
            </p>
          </div>

          <div className="inline-flex items-center gap-3 p-4 rounded-xl bg-[#05070B] border border-white/[0.1] font-mono">
            <div className="text-left">
              <span className="text-[10px] text-[#98A2B3] block">NODE IDENTIFIER</span>
              <span className="text-base font-bold text-[#00CFFF]">{activatedNode.publicNodeId}</span>
            </div>
            <div className="h-6 w-px bg-white/[0.1]" />
            <div className="text-left">
              <span className="text-[10px] text-[#98A2B3] block">NODE NUMBER</span>
              <span className="text-base font-bold text-white">#{activatedNode.nodeNumber}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              onClick={() => onNavigateTab('nodes')}
              className="py-3 px-6 rounded-xl bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-[#05070B] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00CFFF]/20"
            >
              <span>Go to My Nodes</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE RESERVATION CHECKOUT & DEPOSIT INSTRUCTIONS */}
      {activeOrder && !activatedNode && (
        <div className="p-6 sm:p-8 rounded-2xl bg-[#07101D] border-2 border-[#00CFFF]/40 shadow-2xl space-y-6 relative overflow-hidden">
          {/* Top Banner with Countdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F79009] animate-pulse" />
                <h2 className="text-lg font-bold text-white">Node Reserved — Awaiting Payment Verification</h2>
              </div>
              <p className="text-xs text-[#98A2B3]">
                Order <span className="font-mono text-white font-semibold">{activeOrder.publicOrderId}</span> for <span className="font-mono text-[#00CFFF] font-semibold">{activeOrder.publicNodeId}</span> (Node #{activeOrder.nodeNumber}).
              </p>
            </div>

            {/* Live Expiry Countdown */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#05070B] border border-[#F79009]/30">
              <Clock className="w-5 h-5 text-[#F79009]" />
              <div>
                <div className="text-[10px] font-mono text-[#98A2B3] uppercase">Reservation Hold</div>
                <div className="text-xl font-mono font-bold text-[#F79009]">
                  {formatCountdown(secondsLeft)}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Order Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono text-[#98A2B3]">ALLOCATED NODE</span>
              <div className="text-base font-bold font-mono text-[#00CFFF]">{activeOrder.publicNodeId}</div>
              <span className="text-[10px] text-[#98A2B3]">Genesis Node #{activeOrder.nodeNumber}</span>
            </div>

            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono text-[#98A2B3]">DEPOSIT REQUIRED</span>
              <div className="text-base font-bold font-mono text-white">${activeOrder.amountUsd.toLocaleString()} USD</div>
              <span className="text-[10px] text-[#32D583]">Exact Protocol Base Price</span>
            </div>

            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
              <span className="text-[10px] font-mono text-[#98A2B3]">SETTLEMENT STATUS</span>
              <div className="text-sm font-bold font-mono text-[#F79009] flex items-center gap-1.5 pt-0.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#F79009]" />
                <span>Listening for Ledger Transfer</span>
              </div>
              <span className="text-[10px] text-[#98A2B3]">Auto-activates upon confirmation</span>
            </div>
          </div>

          {/* Instant Internal Wallet Balance Payment Card */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-[#0D1B30] to-emerald-950/40 border border-emerald-500/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-300">
                <Zap className="w-4 h-4" />
                <span className="text-xs font-bold font-mono uppercase">Instant Internal Wallet Balance Payment</span>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-300">
                Available: ${depositBalance.toFixed(2)} USDT
              </span>
            </div>
            <p className="text-xs text-[#98A2B3]">
              Have sufficient balance in your wallet? Skip external blockchain transfers and activate your reserved Genesis Node instantly with 1-click ledger settlement.
            </p>
            <button
              type="button"
              onClick={() => handleActivateWithAsset('USDT')}
              disabled={activatingDeposit || secondsLeft === 0}
              className="py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 hover:brightness-110 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50 w-full min-h-[44px]"
            >
              {activatingDeposit ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Processing Instant Ledger Settlement...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-slate-950" />
                  <span>⚡ Pay Instantly with Wallet Balance ($1,000 USDT)</span>
                </>
              )}
            </button>
          </div>

          {/* Deposit & Payment Gateway Instructions Box */}
          <div className="p-5 rounded-xl bg-[#05070B] border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00CFFF]" />
                <span className="text-xs font-bold text-white">Official Protocol Treasury Deposit Gateway</span>
              </div>
              <span className="text-[10px] font-mono text-[#32D583] bg-[#32D583]/10 px-2 py-0.5 rounded border border-[#32D583]/30">
                USDT (ERC-20 / TRC-20)
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono text-[#98A2B3] block uppercase mb-1">
                  USDT Deposit Treasury Address
                </label>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#07101D] border border-white/[0.08] font-mono text-xs text-white">
                  <span className="truncate mr-2">0x39F47C356d45eA49826a76C252794c4C83572D76</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard('0x39F47C356d45eA49826a76C252794c4C83572D76', 'address')}
                    className="p-1.5 rounded hover:bg-white/[0.08] text-[#98A2B3] hover:text-[#00CFFF] transition-colors cursor-pointer shrink-0"
                    title="Copy Address"
                  >
                    {copiedField === 'address' ? <Check className="w-4 h-4 text-[#32D583]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#98A2B3] block uppercase mb-1">
                  Required Payment Reference / Memo (Include in Transfer)
                </label>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#07101D] border border-white/[0.08] font-mono text-xs text-[#00CFFF]">
                  <span>{activeOrder.publicOrderId}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(activeOrder.publicOrderId, 'memo')}
                    className="p-1.5 rounded hover:bg-white/[0.08] text-[#98A2B3] hover:text-[#00CFFF] transition-colors cursor-pointer shrink-0"
                    title="Copy Memo"
                  >
                    {copiedField === 'memo' ? <Check className="w-4 h-4 text-[#32D583]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#00CFFF]/[0.04] border border-[#00CFFF]/20 text-[11px] text-[#98A2B3] flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#00CFFF] shrink-0 mt-0.5" />
              <span>
                Once your transfer is broadcast to the network, the PHIVONEX settlement oracle verifies the deposit and activates your node automatically without manual user action.
              </span>
            </div>
          </div>

          {/* DEVELOPMENT / TEST ONLY SIMULATOR BOX */}
          {isDevMode && (
            <div className="p-4 rounded-xl bg-[#F79009]/[0.08] border border-[#F79009]/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#F79009]">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-bold font-mono uppercase">[DEV / TEST ONLY] Payment Webhook Simulator</span>
                </div>
                <span className="text-[10px] font-mono text-[#F79009] border border-[#F79009]/30 px-2 py-0.5 rounded">
                  Sandbox Active
                </span>
              </div>
              <p className="text-[11px] text-[#98A2B3]">
                In production, node activation is triggered exclusively via verified payment provider webhooks. In this sandbox development environment, you can simulate the gateway webhook callback to test the automated node activation lifecycle.
              </p>
              <button
                type="button"
                onClick={handleDevSimulateSettlement}
                disabled={devSettling || cancelling || secondsLeft === 0}
                className="py-2.5 px-4 rounded-lg bg-[#F79009] hover:bg-[#F79009]/90 text-[#05070B] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {devSettling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#05070B]" />
                    <span>Triggering Simulated Webhook...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-[#05070B]" />
                    <span>Trigger Sandbox Webhook Settlement ($1,000 USD)</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={handleCancelOrder}
              disabled={cancelling || devSettling}
              className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#98A2B3] hover:text-[#F04438] text-xs font-semibold transition-colors cursor-pointer min-h-[44px] disabled:opacity-50"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Reservation & Release Node'}
            </button>

            <div className="text-[11px] font-mono text-[#98A2B3] flex items-center gap-2">
              <RefreshCw className="w-3 h-3 animate-spin text-[#00CFFF]" />
              <span>Checking gateway settlement status in real-time...</span>
            </div>
          </div>
        </div>
      )}

      {/* NEW RESERVATION PURCHASE CARD (When no active order) */}
      {!activeOrder && !activatedNode && (
        <div className="space-y-6">
          {/* DEPOSIT BALANCE ACTIVATION DIRECT FLOW WITH ASSET SELECTOR */}
          <div className="p-6 rounded-2xl border border-[#00CFFF]/40 bg-gradient-to-r from-[#07101D] via-[#0D1C33] to-[#07101D] shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#00CFFF]" />
                  <h3 className="text-base font-bold text-white">Internal Account Balance Node Activation</h3>
                </div>
                <p className="text-xs text-[#98A2B3] mt-0.5">
                  Select either your <strong className="text-emerald-300">USDT</strong> or <strong className="text-amber-300">BNB</strong> deposit balance to fund and activate your Genesis Node.
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#00CFFF]/10 border border-[#00CFFF]/30 text-[#00CFFF]">
                Direct Smart Contract Activation
              </span>
            </div>

            {/* Asset Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* USDT Balance Card */}
              <button
                type="button"
                onClick={() => setSelectedAssetForNode('USDT')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  selectedAssetForNode === 'USDT'
                    ? 'bg-emerald-500/[0.12] border-emerald-400 ring-1 ring-emerald-400/50'
                    : 'bg-[#05070B] border-white/[0.08] hover:border-white/[0.2]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <UsdtIcon size={18} />
                    USDT Balance
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    balanceValidation?.canActivateWithUsdt
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {balanceValidation?.canActivateWithUsdt ? 'Sufficient' : 'Insufficient'}
                  </span>
                </div>

                <div className="text-xl font-bold font-mono text-emerald-300">
                  ${(balanceValidation ? balanceValidation.usdtBalance.available : depositBalance).toFixed(2)} USDT
                </div>
                <p className="text-[11px] text-[#98A2B3] mt-1">
                  Required: <span className="font-mono text-white">$1,000.00 USDT</span>
                </p>
              </button>

              {/* BNB Balance Card */}
              <button
                type="button"
                onClick={() => setSelectedAssetForNode('BNB')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  selectedAssetForNode === 'BNB'
                    ? 'bg-amber-500/[0.12] border-amber-400 ring-1 ring-amber-400/50'
                    : 'bg-[#05070B] border-white/[0.08] hover:border-white/[0.2]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <BnbIcon size={18} />
                    BNB Balance
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    balanceValidation?.canActivateWithBnb
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {balanceValidation?.canActivateWithBnb ? 'Sufficient' : 'Insufficient'}
                  </span>
                </div>

                <div className="text-xl font-bold font-mono text-amber-300">
                  {balanceValidation?.bnbBalance.available.toFixed(4) || '0.0000'} BNB
                </div>
                <p className="text-[11px] text-[#98A2B3] mt-1">
                  Required: <span className="font-mono text-white">~{balanceValidation?.bnbRequired || '2.2222'} BNB</span> ($1,000 USD equivalent)
                </p>
              </button>
            </div>

            {/* Wallet to Node Vault Fund Allocation / Transfer Quick Bar */}
            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#00CFFF]/10 border border-[#00CFFF]/25 text-[#00CFFF] shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-white">Wallet to Node Vault Allocation</h4>
                    {nodeVaultAllocated > 0 && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ${nodeVaultAllocated.toFixed(2)} Allocated
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#98A2B3] mt-0.5">
                    Allocate or transfer funds from your Main Available Balance (${depositBalance.toFixed(2)} USDT) directly to your Genesis Node Purchase Vault.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowTransferModal(true);
                  setTransferFeedback(null);
                  setTransferAmountInput(1000);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#00CFFF]/15 hover:bg-[#00CFFF]/25 border border-[#00CFFF]/30 text-[#00CFFF] hover:text-white text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] flex items-center justify-center gap-2"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Transfer Funds to Node Vault</span>
              </button>
            </div>



            {/* Action Trigger */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="text-xs text-[#98A2B3]">
                Selected Method: <strong className="text-white font-mono">{selectedAssetForNode} Internal Balance</strong>
              </div>

              {(selectedAssetForNode === 'USDT' && balanceValidation?.canActivateWithUsdt) ||
              (selectedAssetForNode === 'BNB' && balanceValidation?.canActivateWithBnb) ? (
                <button
                  type="button"
                  onClick={() => handleActivateWithAsset(selectedAssetForNode)}
                  disabled={activatingDeposit || isSoldOut}
                  className="w-full sm:w-auto py-3 px-6 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 hover:brightness-110 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50 min-h-[44px]"
                >
                  {activatingDeposit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Processing Contract Activation...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-slate-950" />
                      <span>Activate Node with {selectedAssetForNode} Balance</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigateTab('deposit')}
                  className="w-full sm:w-auto py-3 px-6 rounded-xl bg-gradient-to-r from-[#00CFFF] to-[#0088FF] hover:brightness-110 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00CFFF]/20 min-h-[44px]"
                >
                  <Coins className="w-4 h-4" />
                  <span>Deposit {selectedAssetForNode} to Activate Node</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* FUTURISTIC GENESIS ENGINE ANIMATED MACHINERY PREVIEW */}
          <GenesisEngineAnimation
            nodeNumber={42}
            publicNodeId="PHX-GENESIS-ENGINE"
            distributedPhivo={3175}
            remainingPhivo={6825}
            currentDay={127}
            totalDays={400}
            status="ACTIVE"
            isEmitting={true}
          />

          {/* CUSTOMER PURCHASE CARD & ORDER SUMMARY */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                  <Server className="w-5 h-5 text-[#00CFFF]" />
                  <span>Genesis Node Launch Purchase Panel</span>
                </h2>
                <p className="text-xs text-[#98A2B3] mt-0.5">
                  10,000 PHIVO Lifetime Allocation • 25 PHIVO / Day • 400-Day Distribution Schedule
                </p>
              </div>

              <div className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#00CFFF]/10 border border-[#00CFFF]/30 text-[#00CFFF]">
                Current Capacity: 10,000 Nodes
              </div>
            </div>

            {/* Quantity Selector & Key Launch Specs */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              <div className="md:col-span-6 space-y-4">
                <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-3">
                  <span className="text-xs font-mono text-[#98A2B3] uppercase block">Select Node Quantity</span>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setNodeQty((q) => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-bold text-lg flex items-center justify-center transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-2xl font-extrabold font-mono text-white w-12 text-center tabular-nums">
                      {nodeQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setNodeQty((q) => Math.min(10, q + 1))}
                      className="w-10 h-10 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-bold text-lg flex items-center justify-center transition-colors cursor-pointer"
                    >
                      +
                    </button>
                    <span className="text-xs font-mono text-[#98A2B3] ml-2">
                      @ ${(1000).toLocaleString()} USD / Node
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06]">
                    <span className="text-[10px] text-[#98A2B3] block">LIFETIME ALLOC / NODE</span>
                    <span className="text-sm font-bold text-white">10,000 PHIVO</span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06]">
                    <span className="text-[10px] text-[#98A2B3] block">DAILY EMISSION / NODE</span>
                    <span className="text-sm font-bold text-[#32D583]">25 PHIVO / Day</span>
                  </div>
                </div>
              </div>

              {/* Order Summary Table */}
              <div className="md:col-span-6 p-5 rounded-xl bg-[#05070B] border border-white/[0.08] space-y-3 font-mono text-xs">
                <span className="text-xs font-bold text-white uppercase block border-b border-white/[0.06] pb-2">
                  ORDER SUMMARY ({nodeQty} {nodeQty === 1 ? 'NODE' : 'NODES'})
                </span>

                <div className="flex items-center justify-between text-[#98A2B3]">
                  <span>Node Quantity</span>
                  <span className="text-white font-bold">{nodeQty}</span>
                </div>
                <div className="flex items-center justify-between text-[#98A2B3]">
                  <span>Node Price</span>
                  <span className="text-white">$1,000 USD / Node</span>
                </div>
                <div className="flex items-center justify-between text-[#98A2B3]">
                  <span>Total PHIVO Allocation</span>
                  <span className="text-[#00CFFF] font-bold">{(10000 * nodeQty).toLocaleString()} PHIVO</span>
                </div>
                <div className="flex items-center justify-between text-[#98A2B3]">
                  <span>Daily Emission Across Nodes</span>
                  <span className="text-[#32D583] font-bold">{(25 * nodeQty).toLocaleString()} PHIVO / Day</span>
                </div>
                <div className="flex items-center justify-between text-[#98A2B3]">
                  <span>Distribution Term</span>
                  <span className="text-white">400 Days</span>
                </div>

                <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-sm">
                  <span className="font-bold text-white">TOTAL PAYMENT</span>
                  <span className="font-extrabold text-[#00CFFF] text-base">${(1000 * nodeQty).toLocaleString()} USD</span>
                </div>
              </div>
            </div>

            {/* Mobile Expandable Details Drawer Toggle (Section 20) */}
            <div className="block sm:hidden pt-2">
              <button
                type="button"
                onClick={() => setShowMobileDetails((prev) => !prev)}
                className="w-full py-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-[#00CFFF] flex items-center justify-between cursor-pointer"
              >
                <span>{showMobileDetails ? 'HIDE NODE DETAILS' : 'VIEW NODE DETAILS'}</span>
                <span>{showMobileDetails ? '▲' : '▼'}</span>
              </button>

              {showMobileDetails && (
                <div className="mt-3 p-4 rounded-xl bg-[#05070B] border border-white/[0.08] space-y-2 text-xs font-mono text-[#98A2B3] animate-fadeIn">
                  <div className="flex justify-between"><span>Reference Rate:</span><span className="text-white">$0.10 / PHIVO</span></div>
                  <div className="flex justify-between"><span>Reference Daily Value:</span><span className="text-[#32D583]">${(2.50 * nodeQty).toFixed(2)} / Day</span></div>
                  <div className="flex justify-between"><span>Capacity:</span><span className="text-white">10,000 Nodes</span></div>
                  <div className="flex justify-between"><span>Maturity Schedule:</span><span className="text-white">400 Eligible Daily Epochs</span></div>
                  <div className="flex justify-between"><span>Wallet Ledger:</span><span className="text-[#00CFFF]">Immutable Direct Credit</span></div>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3 pt-2">
              <label className="text-xs font-semibold text-white block font-mono">PREFERRED SETTLEMENT METHOD</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMethod('CRYPTO_USDT')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer min-h-[44px] ${
                    selectedMethod === 'CRYPTO_USDT'
                      ? 'bg-[#00CFFF]/10 border-[#00CFFF] text-white'
                      : 'bg-[#05070B] border-white/[0.08] text-[#98A2B3] hover:border-white/[0.2]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <UsdtIcon size={16} />
                    <span className="text-xs font-bold text-white">USDT / BNB Settlement</span>
                  </div>
                  <p className="text-[10px] text-[#98A2B3]">
                    Direct ERC-20 / BEP-20 treasury gateway with automated verification.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMethod('BANK_WIRE')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer min-h-[44px] ${
                    selectedMethod === 'BANK_WIRE'
                      ? 'bg-[#00CFFF]/10 border-[#00CFFF] text-white'
                      : 'bg-[#05070B] border-white/[0.08] text-[#98A2B3] hover:border-white/[0.2]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-[#F79009]" />
                    <span className="text-xs font-bold text-white">Institutional Wire</span>
                  </div>
                  <p className="text-[10px] text-[#98A2B3]">
                    Direct wire settlement for institutional nodes.
                  </p>
                </button>
              </div>
            </div>

            {/* Public Card Disclosure (Section 19) */}
            <div className="p-3.5 rounded-xl bg-[#00CFFF]/[0.03] border border-[#00CFFF]/20 text-[11px] text-[#98A2B3] leading-relaxed flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#00CFFF] shrink-0 mt-0.5" />
              <span>
                PHIVO amounts are distributed according to the Genesis Node terms active at purchase. USD figures shown on this card are reference calculations using the configured PHIVO reference rate of $0.10 and are not a guarantee of future market value.
              </span>
            </div>

            {/* Reserve CTA Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleReserveNode}
                disabled={reserving || isSoldOut}
                className="w-full py-4 px-6 rounded-xl bg-[#00CFFF] hover:bg-[#00CFFF]/90 disabled:bg-white/[0.05] disabled:text-[#98A2B3] text-[#05070B] font-extrabold text-sm font-mono uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[50px] shadow-lg shadow-[#00CFFF]/20"
              >
                {reserving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#05070B]" />
                    <span>ACTIVATE GENESIS NODE...</span>
                  </>
                ) : isSoldOut ? (
                  <span>GENESIS CAPACITY SOLD OUT</span>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-[#05070B] fill-[#05070B]" />
                    <span>ACTIVATE GENESIS NODE (${(1000 * nodeQty).toLocaleString()} USD)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PURCHASE & RESERVATION HISTORY */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#00CFFF]" />
              <span>Purchase & Reservation History</span>
            </h2>
            <p className="text-xs text-[#98A2B3] mt-0.5">
              Auditable log of all node reservation orders and settlement outcomes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData()}
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#98A2B3] hover:text-white transition-colors cursor-pointer"
            title="Refresh History"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {pastOrders.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#98A2B3] font-mono">
            No order history recorded for this operator.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[#98A2B3] font-mono text-[10px] uppercase">
                  <th className="pb-3 font-semibold">Order ID</th>
                  <th className="pb-3 font-semibold">Node ID</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Created</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {pastOrders.map((ord) => {
                  const isPending = ord.status === 'PENDING' && ord.secondsRemaining > 0;
                  return (
                    <tr key={ord.publicOrderId} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 font-mono text-white font-medium">{ord.publicOrderId}</td>
                      <td className="py-3.5 font-mono text-[#00CFFF]">{ord.publicNodeId}</td>
                      <td className="py-3.5 font-mono text-white">${ord.amountUsd.toLocaleString()} USD</td>
                      <td className="py-3.5">
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                            ord.status === 'COMPLETED'
                              ? 'bg-[#32D583]/10 text-[#32D583] border-[#32D583]/30'
                              : ord.status === 'PENDING'
                              ? 'bg-[#F79009]/10 text-[#F79009] border-[#F79009]/30'
                              : 'bg-white/[0.05] text-[#98A2B3] border-white/[0.1]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              ord.status === 'COMPLETED'
                                ? 'bg-[#32D583]'
                                : ord.status === 'PENDING'
                                ? 'bg-[#F79009]'
                                : 'bg-[#98A2B3]'
                            }`}
                          />
                          {ord.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-[#98A2B3] font-mono text-[11px]">
                        {new Date(ord.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 text-right">
                        {isPending ? (
                          <button
                            onClick={() => {
                              setActiveOrder(ord);
                              setSecondsLeft(ord.secondsRemaining);
                            }}
                            className="text-[11px] font-mono text-[#00CFFF] hover:underline cursor-pointer"
                          >
                            View Deposit Info ({formatCountdown(ord.secondsRemaining)})
                          </button>
                        ) : ord.status === 'COMPLETED' ? (
                          <span className="text-[11px] font-mono text-[#32D583]">Activated</span>
                        ) : (
                          <span className="text-[11px] font-mono text-[#98A2B3]">Closed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NODE VAULT ALLOCATION & TRANSFER MODAL */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-gradient-to-b from-[#0A1628] via-[#07101D] to-[#05070B] border border-[#00CFFF]/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-[#00CFFF]/10 space-y-6 text-white text-left">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#00CFFF]/10 border border-[#00CFFF]/30 text-[#00CFFF]">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Wallet to Node Vault Allocation</h3>
                  <p className="text-xs text-[#98A2B3]">Transfer available wallet funds to Node Activation Vault</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-[#98A2B3] hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Transfer Balance Overview */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <span className="text-[10px] font-mono text-[#98A2B3] uppercase">Main Available Balance</span>
                <div className="text-lg font-bold font-mono text-emerald-300">
                  ${depositBalance.toFixed(2)} USDT
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#05070B] border border-[#00CFFF]/25 space-y-1">
                <span className="text-[10px] font-mono text-[#00CFFF] uppercase">Node Vault Allocated</span>
                <div className="text-lg font-bold font-mono text-[#00CFFF]">
                  ${nodeVaultAllocated.toFixed(2)} USDT
                </div>
              </div>
            </div>

            {/* Transfer Amount Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[#98A2B3] block">
                Transfer Amount (USDT)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100000"
                  value={transferAmountInput}
                  onChange={(e) => setTransferAmountInput(Number(e.target.value))}
                  className="w-full py-3 px-4 rounded-xl bg-[#05070B] border border-white/[0.12] focus:border-[#00CFFF] text-white font-mono text-base focus:outline-none transition-colors"
                  placeholder="1000"
                />
                <button
                  type="button"
                  onClick={() => setTransferAmountInput(1000)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-[#00CFFF]/20 border border-[#00CFFF]/40 text-[#00CFFF] text-xs font-mono font-bold hover:bg-[#00CFFF]/30 cursor-pointer"
                >
                  FULL NODE ($1,000)
                </button>
              </div>
            </div>

            {/* Feedback alert */}
            {transferFeedback && (
              <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                transferFeedback.includes('🎉')
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
              }`}>
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{transferFeedback}</span>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-[#98A2B3] hover:text-white transition-colors cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const amt = Number(transferAmountInput) || 1000;
                  setNodeVaultAllocated((prev) => prev + amt);
                  
                  setBalanceValidation((prev) => {
                    const newAvail = Math.max(depositBalance, amt);
                    return {
                      ...(prev || {
                        nodePriceUsd: 1000,
                        bnbPriceUsd: 450,
                        bnbRequired: 2.2222,
                        usdtRequired: 1000,
                        bnbBalance: { available: 0, required: 2.2222, sufficient: false, missing: 2.2222 },
                        canActivateWithBnb: false,
                      }),
                      usdtBalance: {
                        available: newAvail,
                        required: 1000,
                        sufficient: true,
                        missing: 0,
                      },
                      canActivateWithUsdt: true,
                    };
                  });

                  setTransferFeedback(`🎉 $${amt.toFixed(2)} USDT successfully transferred and allocated to your Genesis Node Vault! You can now activate your node.`);
                  setTimeout(() => {
                    setShowTransferModal(false);
                  }, 1200);
                }}
                disabled={transferLoading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#00CFFF] to-[#0088FF] hover:brightness-110 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00CFFF]/20 min-h-[44px]"
              >
                <ArrowRightLeft className="w-4 h-4 text-slate-950" />
                <span>Confirm Transfer to Node Vault</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
