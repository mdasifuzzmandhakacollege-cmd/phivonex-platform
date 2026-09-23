import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  GitFork,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Layers,
  Sparkles,
  Info,
  BarChart3,
  Activity,
  Calendar,
  History,
} from 'lucide-react';

export interface VolumeSummary {
  businessDate: string;
  today: {
    left: number;
    right: number;
  };
  carry: {
    left: number;
    right: number;
  };
  availableForFutureMatching: {
    left: number;
    right: number;
  };
}

export interface VolumeHistoryItem {
  businessDate: string;
  leftUnits: number;
  rightUnits: number;
}

export interface UnplacedMember {
  publicId: string;
  displayName: string;
  joinedAt: string;
  placementStatus: 'UNPLACED';
}

export interface TreeNode {
  user: {
    publicId: string;
    displayName: string;
  };
  side: 'LEFT' | 'RIGHT' | null;
  placedAt: string | null;
  left: TreeNode | null;
  right: TreeNode | null;
}

export interface NetworkSummary {
  directReferrals: number;
  placedMembers: number;
  unplacedDirectReferrals: number;
  leftNetworkMembers: number;
  rightNetworkMembers: number;
}

export const NetworkView: React.FC = () => {
  const [summary, setSummary] = useState<NetworkSummary | null>(null);
  const [unplacedList, setUnplacedList] = useState<UnplacedMember[]>([]);
  const [treeData, setTreeData] = useState<TreeNode | null>(null);
  const [volumeSummary, setVolumeSummary] = useState<VolumeSummary | null>(null);
  const [volumeHistory, setVolumeHistory] = useState<VolumeHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [depth, setDepth] = useState<number>(3);

  const [loading, setLoading] = useState<boolean>(true);
  const [placingMember, setPlacingMember] = useState<{
    member: UnplacedMember;
    side: 'LEFT' | 'RIGHT';
  } | null>(null);
  const [submittingPlacement, setSubmittingPlacement] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch summary, unplaced, tree, and binary sales volume
  const fetchNetworkData = useCallback(async (currentDepth = depth) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [summaryRes, unplacedRes, treeRes, volumeRes, historyRes] = await Promise.all([
        fetch('/api/network/summary', { credentials: 'include' }),
        fetch('/api/network/unplaced', { credentials: 'include' }),
        fetch(`/api/network/tree?depth=${currentDepth}`, { credentials: 'include' }),
        fetch('/api/network/volume-summary', { credentials: 'include' }),
        fetch('/api/network/volume-history?page=1&limit=5', { credentials: 'include' }),
      ]);

      if (!summaryRes.ok || !unplacedRes.ok || !treeRes.ok) {
        throw new Error('Failed to load network information.');
      }

      const summaryData = await summaryRes.json();
      const unplacedData = await unplacedRes.json();
      const treeJson = await treeRes.json();

      setSummary(summaryData);
      setUnplacedList(unplacedData.unplaced || []);
      setTreeData(treeJson.tree || null);

      if (volumeRes.ok) {
        const volData = await volumeRes.json();
        setVolumeSummary(volData);
      }
      if (historyRes.ok) {
        const histData = await historyRes.json();
        setVolumeHistory(histData.history || []);
      }
    } catch (err: any) {
      console.error('Error fetching network:', err);
      setErrorMsg(err.message || 'Unable to connect to network service.');
    } finally {
      setLoading(false);
    }
  }, [depth]);

  useEffect(() => {
    fetchNetworkData(depth);
  }, [fetchNetworkData, depth]);

  const handleConfirmPlacement = async () => {
    if (!placingMember) return;
    setSubmittingPlacement(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/network/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          memberPublicId: placingMember.member.publicId,
          preferredSide: placingMember.side,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Placement failed.');
      }

      setSuccessMsg(
        `Successfully placed ${placingMember.member.displayName} (${data.memberPublicId}) into ${data.side} network (Parent: ${data.parentPublicId}).`
      );
      setPlacingMember(null);
      await fetchNetworkData(depth);
    } catch (err: any) {
      console.error('Placement error:', err);
      setErrorMsg(err.message || 'Failed to complete placement.');
    } finally {
      setSubmittingPlacement(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <GitFork className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Binary Network</h1>
              <p className="text-sm text-slate-400">
                Binary tree structure, deterministic spillover, and unplaced referral assignments
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Depth selector */}
          <div className="flex items-center bg-[#0C192C] border border-white/10 rounded-lg p-1">
            <span className="text-xs text-slate-400 px-2 font-mono">Depth:</span>
            {[2, 3, 4, 5].map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                  depth === d
                    ? 'bg-cyan-500 text-black font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchNetworkData(depth)}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 bg-[#0C192C] hover:bg-[#12233D] text-slate-300 hover:text-white text-xs font-mono font-medium rounded-lg border border-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Action Alert</p>
            <p className="text-xs text-rose-200/80 mt-0.5">{errorMsg}</p>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-mono underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-start space-x-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Placement Success</p>
            <p className="text-xs text-emerald-200/80 mt-0.5">{successMsg}</p>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-mono underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Direct Referrals */}
        <div className="p-5 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Direct Referrals</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {summary ? summary.directReferrals : '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Total sponsored users</div>
        </div>

        {/* Placed Members */}
        <div className="p-5 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Placed Members</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {summary ? summary.placedMembers : '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Placed in binary tree</div>
        </div>

        {/* Unplaced Referrals */}
        <div className="p-5 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Unplaced</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">
            {summary ? summary.unplacedDirectReferrals : '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Pending tree assignment</div>
        </div>

        {/* Left Network */}
        <div className="p-5 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Left Network</span>
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300">
            {summary ? summary.leftNetworkMembers : '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Left subtree members</div>
        </div>

        {/* Right Network */}
        <div className="p-5 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] relative overflow-hidden backdrop-blur-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Right Network</span>
            <ArrowRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-300">
            {summary ? summary.rightNetworkMembers : '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Right subtree members</div>
        </div>
      </div>

      {/* Task #10: Binary Sales Volume Section */}
      <div className="p-6 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] backdrop-blur-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Binary Sales Volume</h2>
              <p className="text-xs text-slate-400">
                Authoritative Genesis Node volume attributed through binary placement ancestry (1 Active Node = 1 Volume Unit).
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 text-xs font-mono">
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Dhaka Date:</span>
              <span className="text-cyan-400 font-bold">{volumeSummary?.businessDate || '—'}</span>
            </div>
          </div>
        </div>

        {/* 3 Metric Groups (6 Metrics total) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Today's Node Sales */}
          <div className="p-4 rounded-xl bg-[#07101D] border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Today's Sales</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-[11px] text-slate-400">Today's Left</div>
                <div className="text-2xl font-bold font-mono text-cyan-300">
                  {volumeSummary ? `${volumeSummary.today.left}` : '—'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">Node Units</div>
              </div>
              <div className="border-l border-white/10 pl-3">
                <div className="text-[11px] text-slate-400">Today's Right</div>
                <div className="text-2xl font-bold font-mono text-emerald-300">
                  {volumeSummary ? `${volumeSummary.today.right}` : '—'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">Node Units</div>
              </div>
            </div>
          </div>

          {/* 2. Carry Forward */}
          <div className="p-4 rounded-xl bg-[#07101D] border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Carry Forward</span>
              <GitFork className="w-4 h-4 text-amber-400" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-[11px] text-slate-400">Carry Left</div>
                <div className="text-2xl font-bold font-mono text-cyan-300">
                  {volumeSummary ? `${volumeSummary.carry.left}` : '—'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">Node Units</div>
              </div>
              <div className="border-l border-white/10 pl-3">
                <div className="text-[11px] text-slate-400">Carry Right</div>
                <div className="text-2xl font-bold font-mono text-emerald-300">
                  {volumeSummary ? `${volumeSummary.carry.right}` : '—'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">Node Units</div>
              </div>
            </div>
          </div>

          {/* 3. Available Volume */}
          <div className="p-4 rounded-xl bg-[#07101D] border border-cyan-500/20 bg-gradient-to-b from-[#07101D] to-[#0A162B] space-y-3">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">Available Volume</span>
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <div className="text-[11px] text-slate-400">Available Left</div>
                <div className="text-2xl font-bold font-mono text-cyan-400">
                  {volumeSummary ? `${volumeSummary.availableForFutureMatching.left}` : '—'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">Eligible Units</div>
              </div>
              <div className="border-l border-white/10 pl-3">
                <div className="text-[11px] text-slate-400">Available Right</div>
                <div className="text-2xl font-bold font-mono text-emerald-400">
                  {volumeSummary ? `${volumeSummary.availableForFutureMatching.right}` : '—'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">Eligible Units</div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Volume History Toggle */}
        <div className="pt-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center space-x-2 text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showHistory ? 'Hide' : 'Show'} Daily Volume Ledger</span>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showHistory && (
            <div className="mt-3 p-4 rounded-xl bg-[#07101D] border border-white/10 overflow-x-auto">
              <div className="text-xs font-mono text-slate-300 font-semibold mb-2">Authoritative Daily Volume History</div>
              {volumeHistory.length === 0 ? (
                <div className="text-xs font-mono text-slate-500 py-3 text-center">
                  No daily volume records generated yet.
                </div>
              ) : (
                <table className="w-full text-xs font-mono text-left">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-2 px-3">Business Date (Dhaka)</th>
                      <th className="py-2 px-3 text-right text-cyan-400">Left Units</th>
                      <th className="py-2 px-3 text-right text-emerald-400">Right Units</th>
                      <th className="py-2 px-3 text-right text-slate-400">Total Units</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {volumeHistory.map((item) => (
                      <tr key={item.businessDate} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-3 text-white">{item.businessDate}</td>
                        <td className="py-2 px-3 text-right text-cyan-300 font-bold">{item.leftUnits}</td>
                        <td className="py-2 px-3 text-right text-emerald-300 font-bold">{item.rightUnits}</td>
                        <td className="py-2 px-3 text-right text-slate-300">{item.leftUnits + item.rightUnits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Unplaced Direct Referrals Section */}
      <div className="p-6 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Unplaced Direct Referrals</h2>
              <p className="text-xs text-slate-400">
                Choose LEFT or RIGHT leg. Deterministic BFS spillover will find the first available slot.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono text-slate-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 w-fit">
            Queue: <span className="text-amber-400 font-bold">{unplacedList.length}</span> unplaced
          </div>
        </div>

        {unplacedList.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-sm text-slate-300 font-medium">All direct referrals are placed</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              When new operators register using your referral link, they will appear here awaiting placement into your LEFT or RIGHT leg.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unplacedList.map((m) => (
              <div
                key={m.publicId}
                className="p-4 rounded-xl bg-[#07101D] border border-white/10 hover:border-amber-500/30 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-300 text-sm font-mono">
                      {m.displayName.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{m.displayName}</div>
                      <div className="text-xs font-mono text-cyan-400">{m.publicId}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-medium">
                    UNPLACED
                  </span>
                </div>

                <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-white/5 pt-2">
                  <span>Joined:</span>
                  <span>{new Date(m.joinedAt).toLocaleDateString()}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setPlacingMember({ member: m, side: 'LEFT' })}
                    className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-medium transition-all hover:border-cyan-500/50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Place LEFT</span>
                  </button>
                  <button
                    onClick={() => setPlacingMember({ member: m, side: 'RIGHT' })}
                    className="flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-mono font-medium transition-all hover:border-emerald-500/50"
                  >
                    <span>Place RIGHT</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Interactive Binary Tree View */}
      <div className="p-6 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] backdrop-blur-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Binary Tree Hierarchy</h2>
              <p className="text-xs text-slate-400">
                Visual display of your binary tree up to depth {depth}. Immutably locked in protocol ledger.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-xs font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              <span className="text-slate-300">LEFT Leg</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300">RIGHT Leg</span>
            </div>
          </div>
        </div>

        {/* Tree Container */}
        <div className="w-full overflow-x-auto py-8 px-4 bg-[#07101D]/90 rounded-xl border border-white/5 min-h-[420px] flex items-center justify-center">
          {loading && !treeData ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-12">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-xs font-mono text-slate-400">Loading binary network tree...</p>
            </div>
          ) : treeData ? (
            <div className="min-w-fit flex flex-col items-center">
              <BinaryTreeNodeRenderer node={treeData} isRoot={true} rootVolume={volumeSummary} />
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 text-xs font-mono">
              No binary tree data found.
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {placingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-[#0B1528] border border-white/20 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center space-x-3">
              <div
                className={`p-3 rounded-xl border ${
                  placingMember.side === 'LEFT'
                    ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}
              >
                <GitFork className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Confirm Network Placement</h3>
                <p className="text-xs text-slate-400">Review placement confirmation</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#07101D] border border-white/10 space-y-2.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Member:</span>
                <span className="text-white font-semibold">{placingMember.member.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Public ID:</span>
                <span className="text-cyan-400 font-bold">{placingMember.member.publicId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Target Leg:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded ${
                    placingMember.side === 'LEFT'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {placingMember.side}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Method:</span>
                <span className="text-slate-300">Deterministic BFS Spillover</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Placement Immutability:</strong> Once placed, this member is permanently anchored into the selected leg and cannot be moved, detached, or altered.
              </p>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setPlacingMember(null)}
                disabled={submittingPlacement}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono font-medium transition-colors border border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPlacement}
                disabled={submittingPlacement}
                className={`flex-1 py-2.5 rounded-xl text-black text-xs font-mono font-bold transition-all shadow-lg flex items-center justify-center space-x-2 ${
                  placingMember.side === 'LEFT'
                    ? 'bg-cyan-400 hover:bg-cyan-300 shadow-cyan-500/20'
                    : 'bg-emerald-400 hover:bg-emerald-300 shadow-emerald-500/20'
                } disabled:opacity-50`}
              >
                {submittingPlacement ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Placing...</span>
                  </>
                ) : (
                  <span>Confirm Placement</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Recursive binary tree visualizer component
 */
interface NodeRendererProps {
  node: TreeNode | null;
  isRoot?: boolean;
  side?: 'LEFT' | 'RIGHT';
  rootVolume?: VolumeSummary | null;
}

const BinaryTreeNodeRenderer: React.FC<NodeRendererProps> = ({ node, isRoot = false, side, rootVolume }) => {
  if (!node) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-36 sm:w-44 p-3 rounded-xl border border-dashed border-white/20 bg-white/[0.02] text-center">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1">
            {side || 'Position'}
          </div>
          <div className="text-xs font-mono text-slate-400">Empty Slot</div>
          <div className="text-[10px] font-mono text-slate-600 mt-1">Available for placement</div>
        </div>
      </div>
    );
  }

  const hasChildren = node.left !== null || node.right !== null;

  return (
    <div className="flex flex-col items-center">
      {/* Node Card */}
      <div
        className={`w-36 sm:w-44 p-3.5 rounded-xl border transition-all relative ${
          isRoot
            ? 'bg-gradient-to-b from-[#122442] to-[#0A162B] border-cyan-500/50 shadow-lg shadow-cyan-500/10'
            : node.side === 'LEFT'
            ? 'bg-[#0B192E] border-cyan-500/30 hover:border-cyan-500/60'
            : 'bg-[#0B1F27] border-emerald-500/30 hover:border-emerald-500/60'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <span
            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
              isRoot
                ? 'bg-cyan-500/20 text-cyan-300'
                : node.side === 'LEFT'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'bg-emerald-500/20 text-emerald-300'
            }`}
          >
            {isRoot ? 'ROOT (YOU)' : node.side}
          </span>
          {node.placedAt && (
            <span className="text-[9px] font-mono text-slate-500">
              {new Date(node.placedAt).toLocaleDateString(undefined, {
                month: 'numeric',
                day: 'numeric',
              })}
            </span>
          )}
        </div>

        <div className="text-xs font-bold text-white truncate">{node.user.displayName}</div>
        <div className="text-[11px] font-mono text-cyan-400 truncate mt-0.5">
          {node.user.publicId}
        </div>

        {/* Optional Root Volume Badges (Task #10) */}
        {isRoot && rootVolume && (
          <div className="mt-2 pt-1.5 border-t border-white/10 grid grid-cols-2 gap-1 text-[10px] font-mono">
            <div className="text-cyan-300 flex items-center justify-between">
              <span>L:</span>
              <span className="font-bold">{rootVolume.availableForFutureMatching.left} Vol</span>
            </div>
            <div className="text-emerald-300 flex items-center justify-between border-l border-white/10 pl-1">
              <span>R:</span>
              <span className="font-bold">{rootVolume.availableForFutureMatching.right} Vol</span>
            </div>
          </div>
        )}
      </div>

      {/* Branch Connectors and Children */}
      {/* Connector line down from parent */}
      <div className="w-0.5 h-6 bg-white/20"></div>

      {/* Horizontal connector bar & child branches */}
      <div className="relative flex justify-center items-start pt-0">
        <div className="grid grid-cols-2 gap-4 sm:gap-8 relative">
          {/* Top connecting bar across children */}
          <div className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-white/20"></div>

          {/* Left Branch */}
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-4 bg-cyan-500/40"></div>
            <BinaryTreeNodeRenderer node={node.left} side="LEFT" />
          </div>

          {/* Right Branch */}
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-4 bg-emerald-500/40"></div>
            <BinaryTreeNodeRenderer node={node.right} side="RIGHT" />
          </div>
        </div>
      </div>
    </div>
  );
};
