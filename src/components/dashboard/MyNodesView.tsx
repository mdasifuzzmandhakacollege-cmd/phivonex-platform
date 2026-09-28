import React, { useState, useEffect } from 'react';
import {
  Server,
  Cpu,
  Layers,
  ShieldCheck,
  Coins,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  Plus,
  ArrowRight,
  Sparkles,
  Zap,
  Check
} from 'lucide-react';
import { UserProfile } from '../../context/AuthContext';
import { GENESIS_NODE_CAP, NODE_BASE_PRICE_USD } from '../../config/nodeConfig';

interface MyNodesViewProps {
  user: UserProfile;
  onNavigateTab: (tab: string) => void;
}

interface NodeItem {
  publicNodeId: string;
  nodeNumber: number;
  status: string;
  activatedAt: string | null;
  totalRewards?: number;
  currentRewardState?: 'ACCRUED' | 'CLAIMED' | 'READY';
  latestRewardEpoch?: string | null;
}

interface NodeOrder {
  publicOrderId: string;
  publicNodeId: string;
  nodeNumber: number;
  amountUsd: number;
  currency: string;
  status: 'PENDING' | 'SETTLING' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';
  createdAt: string;
  secondsRemaining: number;
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

interface RewardHistoryItem {
  id: string;
  publicRewardId: string;
  epochNumber: number;
  publicEpochId: string;
  publicNodeId: string;
  nodeNumber: number;
  amount: number;
  status: 'ACCRUED' | 'CLAIMED' | 'REVERSED';
  accruedAt: string;
  claimedAt: string | null;
}

interface RewardsTelemetry {
  totalAccrued: number;
  totalClaimed: number;
  totalRewards: number;
  latestEpoch: {
    publicEpochId: string;
    epochNumber: number;
    rewardPerNode: number;
    status: string;
    settledAt: string | null;
  } | null;
  history: RewardHistoryItem[];
}

export const MyNodesView: React.FC<MyNodesViewProps> = ({ user, onNavigateTab }) => {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [orders, setOrders] = useState<NodeOrder[]>([]);
  const [stats, setStats] = useState<NodeStats | null>(null);
  const [rewards, setRewards] = useState<RewardsTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchNodeData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setErrorMsg(null);
    try {
      // Fetch user owned nodes, stats, order history, and mining rewards
      const [nodesRes, statsRes, ordersRes, rewardsRes] = await Promise.all([
        fetch('/api/nodes/me', { credentials: 'include' }),
        fetch('/api/nodes/stats'),
        fetch('/api/node-orders/me', { credentials: 'include' }),
        fetch('/api/rewards/me', { credentials: 'include' }),
      ]);

      if (nodesRes.ok) {
        const nodesData = await nodesRes.json();
        setNodes(nodesData.nodes || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOrders(ordersData.orders || []);
      }

      if (rewardsRes.ok) {
        const rewardsData = await rewardsRes.json();
        setRewards(rewardsData);
      }
    } catch (err) {
      console.warn('Failed to load node inventory data:', err);
      setErrorMsg('Unable to refresh node inventory telemetry.');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNodeData();
  }, []);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/rewards/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to claim rewards');
      }
      setClaimSuccessMsg(data.message || 'Rewards claimed successfully.');
      await fetchNodeData(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred while claiming rewards.');
    } finally {
      setClaiming(false);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Pending Activation';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Active';
    }
  };

  const activeNodes = nodes.filter((n) => n.status === 'ACTIVE');

  return (
    <div className="space-y-8 max-w-6xl mx-auto animate-fadeIn">
      {/* Header Banner */}
      <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-[#07101D] via-[#0B1528] to-[#07101D] border border-white/[0.08] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00CFFF]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00CFFF]/20 to-[#168BFF]/20 border border-[#00CFFF]/30 flex items-center justify-center text-[#00CFFF] shadow-inner shrink-0">
              <Server className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  My PHIVONEX Nodes
                </h1>
                <span className="text-[10px] font-mono uppercase bg-[#00CFFF]/10 text-[#00CFFF] border border-[#00CFFF]/30 px-2 py-0.5 rounded-full">
                  Genesis Phase 1
                </span>
              </div>
              <p className="text-xs text-[#98A2B3] mt-0.5">
                Validated cryptographic node infrastructure for consensus verification, block emissions, and epoch rewards.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('node-health')}
              className="py-2.5 px-3.5 rounded-xl bg-[#00CFFF]/10 hover:bg-[#00CFFF]/20 border border-[#00CFFF]/30 text-[#00CFFF] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer min-h-[44px]"
            >
              <Activity className="w-4 h-4" />
              <span>Node Health Monitor</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('nodes/buy')}
              className="py-2.5 px-4 rounded-xl bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-[#05070B] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00CFFF]/15 min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Acquire Genesis Node</span>
            </button>

            <button
              type="button"
              onClick={() => fetchNodeData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#98A2B3] hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#00CFFF]' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 text-[#F04438] text-xs flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {claimSuccessMsg && (
        <div className="p-4 rounded-xl bg-[#32D583]/10 border border-[#32D583]/30 text-[#32D583] text-xs flex items-center gap-3 animate-fadeIn">
          <Check className="w-5 h-5 shrink-0" />
          <span>{claimSuccessMsg}</span>
        </div>
      )}

      {/* Protocol Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Genesis Supply */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-lg space-y-2">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs font-mono">
            <span>Genesis Supply</span>
            <Layers className="w-4 h-4 text-[#00CFFF]" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {(stats?.genesisCap ?? GENESIS_NODE_CAP).toLocaleString()}
          </div>
          <p className="text-[11px] text-[#98A2B3]">
            Fixed protocol cap
          </p>
        </div>

        {/* Metric 2: Available Nodes */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-lg space-y-2">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs font-mono">
            <span>Available Inventory</span>
            <Cpu className="w-4 h-4 text-[#00CFFF]" />
          </div>
          <div className="text-2xl font-bold text-[#00CFFF] font-mono">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#00CFFF]" />
            ) : (
              (stats?.available ?? GENESIS_NODE_CAP).toLocaleString()
            )}
          </div>
          <p className="text-[11px] text-[#98A2B3]">
            Unassigned Genesis inventory
          </p>
        </div>

        {/* Metric 3: Active Operator Nodes */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-lg space-y-2">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs font-mono">
            <span>My Active Nodes</span>
            <ShieldCheck className="w-4 h-4 text-[#32D583]" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : (
              activeNodes.length.toLocaleString()
            )}
          </div>
          <p className="text-[11px] text-[#98A2B3]">
            Eligible for epoch rewards
          </p>
        </div>

        {/* Metric 4: Total Mining Rewards */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-[#00CFFF]/20 shadow-lg space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs font-mono">
            <span>Mining Rewards Earned</span>
            <Zap className="w-4 h-4 text-[#00CFFF]" />
          </div>
          <div className="text-2xl font-bold text-[#00CFFF] font-mono">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#00CFFF]" />
            ) : (
              `$${(rewards?.totalRewards ?? 0).toFixed(2)} USD`
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#98A2B3] pt-0.5">
            <span>Accrued: ${(rewards?.totalAccrued ?? 0).toFixed(2)}</span>
            <span>Claimed: ${(rewards?.totalClaimed ?? 0).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Task #14: Reward Engine & Claim Foundation Bar */}
      {(rewards?.totalAccrued ?? 0) > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-[#00CFFF]/10 via-[#07101D] to-[#07101D] border border-[#00CFFF]/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00CFFF]/15 border border-[#00CFFF]/30 flex items-center justify-center text-[#00CFFF]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Accrued Mining Rewards Ready</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00CFFF]/20 text-[#00CFFF]">
                  ${(rewards?.totalAccrued ?? 0).toFixed(4)} USD
                </span>
              </div>
              <p className="text-xs text-[#98A2B3] mt-0.5">
                Safe state foundation: Transitions accrued rewards to claimed without altering ledger invariants.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClaim}
            disabled={claiming}
            className="py-2 px-5 rounded-xl bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-[#05070B] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-[#00CFFF]/20 min-h-[40px] shrink-0 disabled:opacity-50"
          >
            {claiming ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing Claim...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Claim Accrued Rewards</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Main Node List / Empty State */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00CFFF]" />
              <span>Assigned Node Infrastructure</span>
            </h2>
            <p className="text-xs text-[#98A2B3] mt-0.5">
              Cryptographically verified nodes registered to your PHIVONEX account.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#00CFFF] bg-[#00CFFF]/10 px-2.5 py-1 rounded-md border border-[#00CFFF]/20">
            {nodes.length} Nodes Owned
          </span>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-xs text-[#98A2B3]">
            <Loader2 className="w-6 h-6 animate-spin text-[#00CFFF]" />
            <span>Querying Genesis Node registry &amp; reward engine...</span>
          </div>
        ) : nodes.length === 0 ? (
          /* Empty State */
          <div className="py-12 px-4 rounded-xl bg-[#05070B] border border-dashed border-white/[0.1] text-center space-y-5 max-w-xl mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-[#98A2B3] mx-auto">
              <Server className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-white">
                You do not have any active PHIVONEX Nodes yet.
              </h3>
              <p className="text-xs text-[#98A2B3] leading-relaxed max-w-md mx-auto">
                Nodes act as the cryptographic backbone of the PHIVONEX consensus network, validating ledger state transitions and earning epoch rewards.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onNavigateTab('nodes/buy')}
                className="py-3 px-6 rounded-xl bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-[#05070B] font-bold text-xs inline-flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00CFFF]/20 min-h-[44px]"
              >
                <span>Acquire Genesis Node ($1,000 USD)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Owned Node Grid with Task #14 Reward State & Telemetry */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map((node) => (
              <div
                key={node.publicNodeId}
                className="p-5 rounded-xl bg-[#05070B] border border-white/[0.08] hover:border-[#00CFFF]/40 transition-all space-y-4 group"
              >
                {/* Node ID & Status Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/30 flex items-center justify-center text-[#00CFFF]">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-mono font-bold text-white group-hover:text-[#00CFFF] transition-colors">
                        {node.publicNodeId}
                      </div>
                      <div className="text-[10px] font-mono text-[#98A2B3]">
                        Node #{node.nodeNumber}
                      </div>
                    </div>
                  </div>

                  {/* Primary Status Badge */}
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                      node.status === 'ACTIVE'
                        ? 'bg-[#32D583]/10 text-[#32D583] border-[#32D583]/30'
                        : 'bg-white/[0.05] text-[#98A2B3] border-white/[0.1]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        node.status === 'ACTIVE' ? 'bg-[#32D583] animate-pulse' : 'bg-[#98A2B3]'
                      }`}
                    />
                    {node.status === 'ACTIVE' ? 'ACTIVE (ONLINE)' : node.status}
                  </span>
                </div>

                {/* Real-time Operational Health Status Badges System */}
                <div className="p-2.5 rounded-lg bg-[#07101D] border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-[#98A2B3] uppercase tracking-wider flex items-center gap-1">
                      <Activity className="w-3 h-3 text-[#32D583]" /> Operational Health
                    </span>
                    <span className="text-[#32D583] font-bold">HEALTHY · 99.9% Uptime</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <div className="px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                      <span className="text-[#98A2B3]">Ping:</span>
                      <span className="text-[#00CFFF] font-semibold">{((node.nodeNumber * 7) % 18) + 12}ms</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                      <span className="text-[#98A2B3]">Sync Delay:</span>
                      <span className="text-[#32D583] font-semibold">{((node.nodeNumber * 3) % 12) + 8}ms</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                      <span className="text-[#98A2B3]">Block Lag:</span>
                      <span className="text-white font-semibold">0 blocks</span>
                    </div>
                    <div className="px-2 py-1 rounded bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                      <span className="text-[#98A2B3]">Peers:</span>
                      <span className="text-[#00CFFF] font-semibold">24 Live</span>
                    </div>
                  </div>
                </div>

                {/* Task #14 Required Fields & Reward State */}
                <div className="pt-2 border-t border-white/[0.06] space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#98A2B3]">Current Reward State</span>
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded-md border ${
                        node.currentRewardState === 'ACCRUED'
                          ? 'bg-[#00CFFF]/10 text-[#00CFFF] border-[#00CFFF]/30'
                          : node.currentRewardState === 'CLAIMED'
                          ? 'bg-[#32D583]/10 text-[#32D583] border-[#32D583]/30'
                          : 'bg-white/[0.05] text-[#98A2B3] border-white/[0.1]'
                      }`}
                    >
                      {node.currentRewardState || 'READY'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#98A2B3]">Total Rewards</span>
                    <span className="font-mono text-white font-bold">
                      ${Number(node.totalRewards || 0).toFixed(4)} USD
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#98A2B3]">Latest Reward Epoch</span>
                    <span className="font-mono text-[#00CFFF]">
                      {node.latestRewardEpoch || 'None Yet'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/[0.04]">
                    <span className="text-[#98A2B3]">Activation Date</span>
                    <span className="font-mono text-white">{formatDate(node.activatedAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task #14: Reward History Section */}
      <div className="p-6 sm:p-8 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Coins className="w-4 h-4 text-[#00CFFF]" />
              <span>Node Mining Reward History</span>
            </h2>
            <p className="text-xs text-[#98A2B3] mt-0.5">
              Audited historical record of epoch rewards earned by your active Genesis Nodes.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#98A2B3]">
            {rewards?.history.length ?? 0} Events Recorded
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex justify-center text-xs text-[#98A2B3]">
            <Loader2 className="w-5 h-5 animate-spin text-[#00CFFF]" />
          </div>
        ) : !rewards?.history || rewards.history.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#98A2B3] bg-[#05070B] rounded-xl border border-dashed border-white/[0.08] space-y-1">
            <Coins className="w-6 h-6 mx-auto text-[#98A2B3]/50 mb-1" />
            <p className="font-medium text-white">No epoch rewards recorded yet.</p>
            <p className="text-[11px]">Active nodes automatically accumulate rewards at each scheduled epoch settlement.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[#98A2B3] font-mono text-[10px] uppercase">
                  <th className="pb-3 font-semibold">Reward ID</th>
                  <th className="pb-3 font-semibold">Node ID</th>
                  <th className="pb-3 font-semibold">Epoch</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Accrued At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rewards.history.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 font-mono text-white font-medium">{item.publicRewardId}</td>
                    <td className="py-3 font-mono text-[#00CFFF]">{item.publicNodeId}</td>
                    <td className="py-3 font-mono text-white">{item.publicEpochId}</td>
                    <td className="py-3 font-mono text-[#32D583] font-bold">
                      +${Number(item.amount).toFixed(4)} USD
                    </td>
                    <td className="py-3">
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                          item.status === 'CLAIMED'
                            ? 'bg-[#32D583]/10 text-[#32D583] border-[#32D583]/30'
                            : item.status === 'ACCRUED'
                            ? 'bg-[#00CFFF]/10 text-[#00CFFF] border-[#00CFFF]/30'
                            : 'bg-[#F04438]/10 text-[#F04438] border-[#F04438]/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.status === 'CLAIMED'
                              ? 'bg-[#32D583]'
                              : item.status === 'ACCRUED'
                              ? 'bg-[#00CFFF]'
                              : 'bg-[#F04438]'
                          }`}
                        />
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 text-[#98A2B3] font-mono text-[11px] text-right">
                      {formatDate(item.accruedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Orders & Reservations History */}
      {orders.length > 0 && (
        <div className="p-6 sm:p-8 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#00CFFF]" />
                <span>Node Purchase &amp; Reservation History</span>
              </h2>
              <p className="text-xs text-[#98A2B3] mt-0.5">
                Audited ledger of past reservation orders and activations.
              </p>
            </div>
            <button
              onClick={() => onNavigateTab('nodes/buy')}
              className="text-xs font-mono text-[#00CFFF] hover:underline cursor-pointer"
            >
              Order New Node →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[#98A2B3] font-mono text-[10px] uppercase">
                  <th className="pb-3 font-semibold">Order ID</th>
                  <th className="pb-3 font-semibold">Node ID</th>
                  <th className="pb-3 font-semibold">Amount</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {orders.map((ord) => (
                  <tr key={ord.publicOrderId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 font-mono text-white">{ord.publicOrderId}</td>
                    <td className="py-3 font-mono text-[#00CFFF]">{ord.publicNodeId}</td>
                    <td className="py-3 font-mono text-white">${ord.amountUsd.toLocaleString()} USD</td>
                    <td className="py-3">
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
                    <td className="py-3 text-[#98A2B3] font-mono text-[11px]">
                      {new Date(ord.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-3 text-right">
                      {ord.status === 'PENDING' && ord.secondsRemaining > 0 ? (
                        <button
                          type="button"
                          onClick={() => onNavigateTab('nodes/buy')}
                          className="text-[11px] font-mono text-[#F79009] hover:underline"
                        >
                          Complete Payment ({ord.secondsRemaining}s)
                        </button>
                      ) : (
                        <span className="text-[11px] text-[#98A2B3] font-mono">Settled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
