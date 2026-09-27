import React from 'react';
import {
  Sparkles,
  Clock,
  ArrowLeft,
  ArrowRight,
  GitFork,
  CheckCircle2,
  AlertCircle,
  Layers,
  Calendar,
  History,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

export interface MatchingComponentPlan {
  sequenceNo: number;
  tierUnits: number;
  leftUnits: number;
  rightUnits: number;
  bonusUsd: number;
}

export interface MatchingSettlementItem {
  id: string;
  publicSettlementId: string;
  businessDate: string;
  availableLeft: number;
  availableRight: number;
  consumedLeft: number;
  consumedRight: number;
  carryLeftBefore: number;
  carryRightBefore: number;
  carryLeftAfter: number;
  carryRightAfter: number;
  totalBonusUsd: number;
  status: 'COMPLETED' | 'REVERSED';
  settledAt: string;
  components: MatchingComponentPlan[];
}

export interface MatchingSummary {
  todayVolume: {
    left: number;
    right: number;
  };
  carry: {
    left: number;
    right: number;
  };
  latestSettlement: MatchingSettlementItem | null;
  totalMatchingEarnedUsd: number;
  activeTiers?: Array<{ units: number; bonusUsd?: number; rewardUsd?: number }>;
  nextSettlement: {
    scheduledTime: string;
    nextSettlementIso: string;
    msUntilNext: number;
  };
}

interface MatchingSectionProps {
  summary: MatchingSummary | null;
  history: MatchingSettlementItem[];
  loading: boolean;
}

export const MatchingSection: React.FC<MatchingSectionProps> = ({
  summary,
  history,
  loading,
}) => {
  const formatUsd = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string): string => {
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] backdrop-blur-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              Daily Binary Matching Settlement
            </h2>
            <p className="text-xs text-slate-400">
              Authoritative daily closing at 00:00 Asia/Dhaka. Consumes paired Left/Right node sales volume.
            </p>
          </div>
        </div>

        {/* Next Daily Settlement Badge */}
        <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-slate-400">Next Daily Settlement:</span>
          <span className="font-bold">00:00 Asia/Dhaka</span>
        </div>
      </div>

      {/* 4 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Node Sales */}
        <div className="p-4 rounded-xl bg-[#07101D] border border-white/10 space-y-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Today's Sales</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <div className="text-[11px] text-slate-400">Today's Left Sales</div>
              <div className="text-2xl font-bold font-mono text-cyan-300">
                {summary ? summary.todayVolume.left : '—'}
              </div>
              <div className="text-[10px] font-mono text-slate-500">Units</div>
            </div>
            <div className="border-l border-white/10 pl-2">
              <div className="text-[11px] text-slate-400">Today's Right Sales</div>
              <div className="text-2xl font-bold font-mono text-emerald-300">
                {summary ? summary.todayVolume.right : '—'}
              </div>
              <div className="text-[10px] font-mono text-slate-500">Units</div>
            </div>
          </div>
        </div>

        {/* 2. Carry Forward */}
        <div className="p-4 rounded-xl bg-[#07101D] border border-white/10 space-y-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Carry Forward</span>
            <GitFork className="w-4 h-4 text-amber-400" />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <div className="text-[11px] text-slate-400">Carry Left</div>
              <div className="text-2xl font-bold font-mono text-cyan-300">
                {summary ? summary.carry.left : '—'}
              </div>
              <div className="text-[10px] font-mono text-slate-500">Units</div>
            </div>
            <div className="border-l border-white/10 pl-2">
              <div className="text-[11px] text-slate-400">Carry Right</div>
              <div className="text-2xl font-bold font-mono text-emerald-300">
                {summary ? summary.carry.right : '—'}
              </div>
              <div className="text-[10px] font-mono text-slate-500">Units</div>
            </div>
          </div>
        </div>

        {/* 3. Total Matching Bonus Earned */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-[#07101D] to-[#0d221c] border border-emerald-500/30 space-y-2">
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">Matching Bonus Earned</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="pt-1">
            <div className="text-[11px] text-slate-400">Total Matching Bonus Earned</div>
            <div className="text-2xl font-bold font-mono text-emerald-300">
              {summary ? formatUsd(summary.totalMatchingEarnedUsd) : '—'}
            </div>
            <div className="text-[10px] font-mono text-emerald-400/70">Authoritative Ledger Earned</div>
          </div>
        </div>

        {/* 4. Latest Matching Bonus */}
        <div className="p-4 rounded-xl bg-[#07101D] border border-white/10 space-y-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Latest Matching Bonus</span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="pt-1">
            {summary?.latestSettlement ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {formatDate(summary.latestSettlement.businessDate)}
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    {formatUsd(summary.latestSettlement.totalBonusUsd)}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Consumed: L {summary.latestSettlement.consumedLeft} / R {summary.latestSettlement.consumedRight}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  Carry After: L {summary.latestSettlement.carryLeftAfter} / R {summary.latestSettlement.carryRightAfter}
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-bold font-mono text-slate-400">No Settlement Yet</div>
                <div className="text-[11px] text-slate-500 mt-1">Closes at 00:00 Asia/Dhaka</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Official Dynamic Matching Tiers Reference */}
      {(() => {
        const defaultTiers = [
          { units: 2, bonusUsd: 500 },
          { units: 4, bonusUsd: 1000 },
          { units: 8, bonusUsd: 1500 },
          { units: 12, bonusUsd: 2000 },
          { units: 16, bonusUsd: 2500 },
          { units: 20, bonusUsd: 3000 },
          { units: 24, bonusUsd: 3500 },
          { units: 28, bonusUsd: 4000 },
          { units: 32, bonusUsd: 4500 },
          { units: 36, bonusUsd: 5000 },
        ];
        const displayTiers = summary?.activeTiers && summary.activeTiers.length > 0
          ? summary.activeTiers
          : defaultTiers;

        return (
          <div className="p-4 rounded-xl bg-[#07101D]/70 border border-white/5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-300">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-white">Daily Binary Matching Tiers</span>
                <span className="text-slate-500 text-[11px]">(Live Dynamic Payout Schedule)</span>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                {displayTiers.length} Active Slabs
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs font-mono">
              {displayTiers.map((tier, idx) => {
                const reward = (tier as any).bonusUsd ?? (tier as any).rewardUsd ?? 0;
                return (
                  <div key={idx} className="p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition-all text-center">
                    <div className="text-slate-400 text-[10px]">Tier {idx + 1}</div>
                    <div className="font-bold text-white text-xs mt-0.5">L-{tier.units} = R-{tier.units}</div>
                    <div className="text-emerald-400 text-xs font-bold mt-1">${reward.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Matching History */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-300">
            <History className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold uppercase tracking-wider">Matching History & Settlement Components</span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            {history.length} {history.length === 1 ? 'Settlement' : 'Settlements'}
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#07101D] border border-white/5 text-center space-y-1">
            <div className="text-xs font-mono text-slate-400">No matching settlements generated yet.</div>
            <div className="text-[11px] font-mono text-slate-500">
              The matching engine closes automatically at 00:00 Asia/Dhaka and settles all eligible volume.
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((settlement) => (
              <div
                key={settlement.id}
                className="p-4 rounded-xl bg-[#07101D] border border-white/10 space-y-3"
              >
                {/* Settlement Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-bold font-mono text-white">
                      {formatDate(settlement.businessDate)}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                      {settlement.publicSettlementId}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                        settlement.status === 'COMPLETED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {settlement.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono text-slate-400">Total Bonus:</span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      {formatUsd(settlement.totalBonusUsd)}
                    </span>
                  </div>
                </div>

                {/* Components Table if components exist */}
                {settlement.components.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                      Matching Tier Components:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {settlement.components.map((comp) => (
                        <div
                          key={comp.sequenceNo}
                          className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5 text-xs font-mono"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 text-[10px] font-bold">
                              {comp.tierUnits} / {comp.tierUnits}
                            </span>
                            <span className="text-slate-300">Tier</span>
                          </div>
                          <span className="text-emerald-400 font-bold">
                            {formatUsd(comp.bonusUsd)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-slate-500 italic">
                    No matching pairs met the minimum 2/2 tier. 0 units consumed.
                  </div>
                )}

                {/* Footer Volume Accounting */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Available Volume:</span>
                    <span className="text-slate-300">
                      L {settlement.availableLeft} / R {settlement.availableRight}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Consumed Volume:</span>
                    <span className="text-cyan-400">
                      L {settlement.consumedLeft} / R {settlement.consumedRight}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Carry Forward:</span>
                    <span className="text-emerald-400 font-bold">
                      L {settlement.carryLeftAfter} / R {settlement.carryRightAfter}
                    </span>
                  </div>
                  <div className="text-right sm:text-left">
                    <span className="text-slate-500 text-[10px] block">Settled At (UTC):</span>
                    <span className="text-slate-400 text-[11px]">
                      {new Date(settlement.settledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
