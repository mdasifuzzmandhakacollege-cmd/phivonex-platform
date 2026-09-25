import React from 'react';
import {
  Trophy,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  Award,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export interface AchievedMilestone {
  id: string;
  publicBonusId: string;
  milestone: '20/20' | '50/50' | '100/100';
  leftUnits: number;
  rightUnits: number;
  amountUsd: number;
  status: 'EARNED' | 'REVERSED';
  qualifiedAt: string;
  createdAt: string;
}

export interface NextMilestoneProgress {
  milestone: '20/20' | '50/50' | '100/100';
  unitsRequired: number;
  bonusUsd: number;
  leftNeeded: number;
  rightNeeded: number;
  progressPct: number;
}

export interface MilestoneDisplayItem {
  milestone: '20/20' | '50/50' | '100/100';
  unitsRequired: number;
  bonusUsd: number;
  achieved: boolean;
  achievedAt: string | null;
  publicBonusId: string | null;
  leftNeeded: number;
  rightNeeded: number;
  progressPct: number;
}

export interface PromotionSummaryResponse {
  currentProgress: {
    leftUnits: number;
    rightUnits: number;
  };
  achievedMilestones: AchievedMilestone[];
  nextMilestone: NextMilestoneProgress | null;
  totalPromotionBonusEarned: number;
  milestones: MilestoneDisplayItem[];
}

interface PromotionSectionProps {
  data: PromotionSummaryResponse | null;
  loading: boolean;
}

export const PromotionSection: React.FC<PromotionSectionProps> = ({ data, loading }) => {
  const formatUsd = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const currentLeft = data?.currentProgress.leftUnits ?? 0;
  const currentRight = data?.currentProgress.rightUnits ?? 0;
  const totalEarned = data?.totalPromotionBonusEarned ?? 0;
  const next = data?.nextMilestone;

  return (
    <div className="p-6 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] backdrop-blur-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              Promotion Milestone Bonuses
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Official Incentives
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              One-time milestone bonuses awarded when cumulative binary sales reach both LEFT and RIGHT legs.
            </p>
          </div>
        </div>

        {/* Promotion Bonus Earned Badge */}
        <div className="flex items-center space-x-2.5 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
          <Award className="w-4 h-4 text-amber-400" />
          <div className="text-right">
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Promotion Bonus Earned</div>
            <div className="text-lg font-bold font-mono text-amber-300">{formatUsd(totalEarned)}</div>
          </div>
        </div>
      </div>

      {/* Progress & Next Milestone Spotlight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left & Right Current Progress */}
        <div className="p-4 rounded-xl bg-[#07101D] border border-white/10 space-y-2">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Cumulative Sales Volume</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <div className="text-[11px] text-slate-400">Current Left Leg</div>
              <div className="text-2xl font-bold font-mono text-cyan-300">{currentLeft}</div>
              <div className="text-[10px] font-mono text-slate-500">Units Active</div>
            </div>
            <div className="border-l border-white/10 pl-3">
              <div className="text-[11px] text-slate-400">Current Right Leg</div>
              <div className="text-2xl font-bold font-mono text-emerald-300">{currentRight}</div>
              <div className="text-[10px] font-mono text-slate-500">Units Active</div>
            </div>
          </div>
        </div>

        {/* Next Milestone Target */}
        <div className="lg:col-span-2 p-4 rounded-xl bg-gradient-to-br from-[#07101D] to-[#121626] border border-white/10 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Next Milestone Target</span>
            {next ? (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                Reward: {formatUsd(next.bonusUsd)}
              </span>
            ) : (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                All Milestones Completed!
              </span>
            )}
          </div>

          {next ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white font-bold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Target: {next.milestone} Milestone
                </span>
                <span className="text-slate-400">
                  {next.progressPct}% Progress
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-500"
                  style={{ width: `${next.progressPct}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Required: {next.unitsRequired} Left / {next.unitsRequired} Right</span>
                <span className="text-amber-300">
                  {next.leftNeeded > 0 ? `${next.leftNeeded} Left ` : 'Left Complete, '}
                  {next.rightNeeded > 0 ? `${next.rightNeeded} Right needed` : 'Right Complete'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3 py-2 text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
              <div>
                <div className="text-sm font-bold font-mono">Elite Promotion Master Achieved</div>
                <div className="text-xs text-slate-400">You have earned all official milestone bonuses (20/20, 50/50, 100/100).</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Official 3 Milestone Cards: 20/20, 50/50, 100/100 */}
      <div className="space-y-3">
        <div className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <span>Official Milestone Tiers</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-500 lowercase">Awarded once per qualified member</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data?.milestones.map((tier) => {
            const isCompleted = tier.achieved;

            return (
              <div
                key={tier.milestone}
                className={`p-4 rounded-xl border transition-all ${
                  isCompleted
                    ? 'bg-gradient-to-br from-amber-500/10 to-[#07101D] border-amber-500/30'
                    : 'bg-[#07101D] border-white/10 opacity-90'
                }`}
              >
                {/* Tier Card Top */}
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <div className="flex items-center space-x-2">
                    <span className="text-base font-bold font-mono text-white tracking-wide">
                      {tier.milestone}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">Legs</span>
                  </div>

                  {isCompleted ? (
                    <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>EARNED</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10 text-[10px] font-mono">
                      <Lock className="w-3 h-3 text-slate-500" />
                      <span>{tier.progressPct}%</span>
                    </span>
                  )}
                </div>

                {/* Bonus Amount */}
                <div className="pt-3 pb-2">
                  <div className="text-[10px] font-mono uppercase text-slate-400">Bonus Reward</div>
                  <div
                    className={`text-2xl font-bold font-mono ${
                      isCompleted ? 'text-amber-300' : 'text-slate-300'
                    }`}
                  >
                    {formatUsd(tier.bonusUsd)}
                  </div>
                </div>

                {/* Progress or Completion Status */}
                <div className="pt-2 border-t border-white/5 text-xs font-mono">
                  {isCompleted ? (
                    <div className="space-y-1">
                      <div className="text-[11px] text-emerald-400/90 flex items-center justify-between">
                        <span>Awarded:</span>
                        <span className="text-slate-300">{formatDate(tier.achievedAt)}</span>
                      </div>
                      {tier.publicBonusId && (
                        <div className="text-[10px] text-slate-500 text-right">
                          ID: {tier.publicBonusId}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Left: {currentLeft} / {tier.unitsRequired}</span>
                        <span>Right: {currentRight} / {tier.unitsRequired}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-amber-500/70 rounded-full"
                          style={{ width: `${tier.progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
