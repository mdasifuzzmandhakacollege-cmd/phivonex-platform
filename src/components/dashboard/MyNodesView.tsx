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
  Info
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

export const MyNodesView: React.FC<MyNodesViewProps> = ({ user, onNavigateTab }) => {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [orders, setOrders] = useState<NodeOrder[]>([]);
  const [stats, setStats] = useState<NodeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchNodeData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setErrorMsg(null);
    try {
      // Fetch user owned nodes, stats, and order history
      const [nodesRes, statsRes, ordersRes] = await Promise.all([
        fetch('/api/nodes/me', { credentials: 'include' }),
        fetch('/api/nodes/stats'),
        fetch('/api/node-orders/me', { credentials: 'include' }),
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
                Validated cryptographic node infrastructure for consensus verification and block finality.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
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

      {/* Real Genesis Protocol Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Genesis Supply */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-lg space-y-2">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs font-mono">
            <span>Genesis Node Supply</span>
            <Layers className="w-4 h-4 text-[#00CFFF]" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {(stats?.genesisCap ?? GENESIS_NODE_CAP).toLocaleString()}
          </div>
          <p className="text-[11px] text-[#98A2B3]">
            Fixed immutable protocol cap
          </p>
        </div>

        {/* Metric 2: Base Node Price */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-lg space-y-2">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs font-mono">
            <span>Base Node Price</span>
            <Coins className="w-4 h-4 text-[#32D583]" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ${(stats?.basePriceUsd ?? NODE_BASE_PRICE_USD).toLocaleString()} <span className="text-xs font-normal text-[#98A2B3]">USD</span>
          </div>
          <p className="text-[11px] text-[#98A2B3]">
            Uniform Genesis allocation price
          </p>
        </div>

        {/* Metric 3: Available Nodes */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-lg space-y-2">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs font-mono">
            <span>Available Nodes</span>
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

        {/* Metric 4: Operator Owned Nodes */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-lg space-y-2">
          <div className="flex items-center justify-between text-[#98A2B3] text-xs font-mono">
            <span>My Active Nodes</span>
            <ShieldCheck className="w-4 h-4 text-[#32D583]" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : (
              nodes.length.toLocaleString()
            )}
          </div>
          <p className="text-[11px] text-[#98A2B3]">
            Assigned to your operator ID
          </p>
        </div>
      </div>

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
            <span>Querying Genesis Node registry...</span>
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
                Nodes act as the cryptographic backbone of the PHIVONEX consensus network, validating ledger state transitions and securing block emissions.
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
          /* Owned Node Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nodes.map((node) => (
              <div
                key={node.publicNodeId}
                className="p-5 rounded-xl bg-[#05070B] border border-white/[0.08] hover:border-[#00CFFF]/40 transition-all space-y-4 group"
              >
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
                  <span className="text-[10px] font-mono uppercase bg-[#32D583]/10 text-[#32D583] border border-[#32D583]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#32D583]" />
                    {node.status}
                  </span>
                </div>

                <div className="pt-2 border-t border-white/[0.06] space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#98A2B3]">Activation Date</span>
                    <span className="font-mono text-white">{formatDate(node.activatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#98A2B3]">Consensus Tier</span>
                    <span className="font-mono text-[#00CFFF]">Genesis Validator</span>
                  </div>
                </div>
              </div>
            ))}
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
                <span>Node Purchase & Reservation History</span>
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
                          onClick={() => onNavigateTab('nodes/buy')}
                          className="text-[11px] font-mono text-[#00CFFF] hover:underline cursor-pointer"
                        >
                          Complete Order
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono text-[#98A2B3]">Finalized</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Protocol Architecture Notice Card */}
      <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-lg space-y-3">
        <div className="flex items-center gap-2 text-white font-bold text-xs">
          <ShieldCheck className="w-4 h-4 text-[#32D583]" />
          <span>Genesis Invariant & Inventory Protocol</span>
        </div>
        <p className="text-xs text-[#98A2B3] leading-relaxed">
          The PHIVONEX protocol maintains a strict mathematical invariant of exactly 10,000 Genesis Nodes (<code className="text-[#00CFFF] font-mono">available + reserved + active + retired = 10,000</code>). No nodes can ever be generated above this cap.
        </p>
      </div>
    </div>
  );
};

