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
  ExternalLink
} from 'lucide-react';
import { UserProfile } from '../../context/AuthContext';
import { GENESIS_NODE_CAP, NODE_BASE_PRICE_USD, RESERVATION_EXPIRY_MINUTES } from '../../config/nodeConfig';

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [activatedNode, setActivatedNode] = useState<{ publicNodeId: string; nodeNumber: number } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

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

  // Fetch stats and user orders
  const loadData = async (isBackground = false) => {
    if (!isBackground) setErrorMsg(null);
    try {
      const [statsRes, ordersRes, depRes, valRes] = await Promise.all([
        fetch('/api/nodes/stats'),
        fetch('/api/node-orders/me', { credentials: 'include' }),
        fetch('/api/deposits/me?page=1&limit=10', { credentials: 'include' }),
        fetch('/api/node-orders/balance-validation', { credentials: 'include' }),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (valRes.ok) {
        const valData = await valRes.json();
        if (valData.success && valData.validation) {
          setBalanceValidation(valData.validation);
        }
      }

      if (depRes.ok) {
        const depData = await depRes.json();
        if (depData.success && depData.data?.summary) {
          const totalCredited = Number(depData.data.summary.totalCreditedBnb || 0);
          // Check credited deposits
          const creditedDeposits = (depData.data.deposits || []).filter((d: any) => d.status === 'CREDITED');
          const sumCredited = creditedDeposits.reduce((acc: number, d: any) => acc + Number(d.amount || 0), 0);
          setDepositBalance(sumCredited > 0 ? sumCredited : totalCredited);
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
              <span className="text-lg font-bold text-white font-mono">${NODE_BASE_PRICE_USD.toLocaleString()} USD</span>
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
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
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
                  ${balanceValidation?.usdtBalance.available.toFixed(2) || depositBalance.toFixed(2)} USDT
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
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
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

          <div className="p-6 sm:p-8 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-[#00CFFF]" />
                <span>Genesis Node Specification</span>
              </h2>
              <p className="text-xs text-[#98A2B3]">
                Lock your spot in the initial 10,000 Genesis consensus validators.
              </p>
            </div>

            <span className="text-xs font-mono text-[#32D583] bg-[#32D583]/10 px-3 py-1 rounded-full border border-[#32D583]/30">
              Tier 1 Genesis
            </span>
          </div>

          {/* Specs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
              <div className="text-[10px] font-mono text-[#98A2B3]">CONSENSUS WEIGHT</div>
              <div className="text-sm font-bold text-white font-mono">1.00x Validator Tier</div>
              <p className="text-[10px] text-[#98A2B3]">Full block verification authority</p>
            </div>

            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
              <div className="text-[10px] font-mono text-[#98A2B3]">ACQUISITION PRICE</div>
              <div className="text-sm font-bold text-white font-mono">$1,000 USD</div>
              <p className="text-[10px] text-[#98A2B3]">Guaranteed Genesis base tier</p>
            </div>

            <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
              <div className="text-[10px] font-mono text-[#98A2B3]">INVENTORY STATUS</div>
              <div className="text-sm font-bold text-[#00CFFF] font-mono">
                {isSoldOut ? 'Sold Out' : `${(stats?.available ?? 0).toLocaleString()} Available`}
              </div>
              <p className="text-[10px] text-[#98A2B3]">Strictly capped at 10,000</p>
            </div>
          </div>

          {/* Payment Method Option */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-white block">Preferred Settlement Protocol</label>
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
                  <Coins className="w-4 h-4 text-[#32D583]" />
                  <span className="text-xs font-bold text-white">USDT Settlement</span>
                </div>
                <p className="text-[10px] text-[#98A2B3]">
                  Direct ERC-20 / TRC-20 protocol treasury gateway with automated verification.
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
                  Direct bank transfer for institutional nodes.
                </p>
              </button>
            </div>
          </div>

          {/* Reservation Policy Note */}
          <div className="p-4 rounded-xl bg-[#00CFFF]/[0.03] border border-[#00CFFF]/20 text-xs text-[#98A2B3] flex items-start gap-3">
            <Info className="w-4 h-4 text-[#00CFFF] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-white block">Atomic 15-Minute Reservation Hold</span>
              <span className="text-[11px] leading-relaxed block">
                When you click "Reserve Genesis Node", the protocol atomically locks the next available node number for 15 minutes. If settlement is not confirmed within 15 minutes, the node is automatically returned to available inventory.
              </span>
            </div>
          </div>

          {/* Reserve CTA Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleReserveNode}
              disabled={reserving || isSoldOut}
              className="w-full py-3.5 px-6 rounded-xl bg-[#00CFFF] hover:bg-[#00CFFF]/90 disabled:bg-white/[0.05] disabled:text-[#98A2B3] text-[#05070B] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[48px] shadow-lg shadow-[#00CFFF]/15"
            >
              {reserving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#05070B]" />
                  <span>Locking Genesis Node Allocation...</span>
                </>
              ) : isSoldOut ? (
                <span>Genesis Node Allocation Sold Out</span>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-[#05070B]" />
                  <span>Reserve Genesis Node ($1,000 USD)</span>
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
    </div>
  );
};
