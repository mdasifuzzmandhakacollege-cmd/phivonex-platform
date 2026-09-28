import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
  Users,
  ChevronRight,
  Check,
  AlertCircle,
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

export interface PromotionRule {
  id: string;
  rankKey: string;
  rankName: string;
  rankOrder: number;
  qualificationType: 'NONE' | 'MATCHING' | 'LEADERSHIP';
  requiredLeft: number;
  requiredRight: number;
  requiredLeaderRank: string | null;
  legBalanceRule: 'FLEXIBLE' | 'STRICT';
  rewardUsd: number;
  flushRule: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
}

export interface UserRankState {
  userId: string;
  currentRank: string;
  currentRankName: string;
  currentRankOrder: number;
  nextRank: string | null;
  nextRankName: string | null;
  nextRankOrder: number | null;
  qualificationType: 'NONE' | 'MATCHING' | 'LEADERSHIP' | null;
  stageProgress: {
    matching?: {
      leftProgress: number;
      rightProgress: number;
      requiredLeft: number;
      requiredRight: number;
      progressPct: number;
      cumulativeConsumedLeft: number;
      cumulativeConsumedRight: number;
      totalActiveVolumeLeft: number;
      totalActiveVolumeRight: number;
    };
    leadership?: {
      leftLeaders: number;
      rightLeaders: number;
      requiredLeft: number;
      requiredRight: number;
      requiredLeaderRank: string;
      requiredLeaderRankName: string;
      legBalanceRule: string;
      progressPct: number;
      leftLeaderDetails: Array<{ userId: string; publicId: string; fullName: string }>;
      rightLeaderDetails: Array<{ userId: string; publicId: string; fullName: string }>;
    };
  };
  completedEvents: Array<{
    id: string;
    publicPromotionId: string;
    rankKey: string;
    rankName: string;
    rankOrder: number;
    previousRank: string;
    qualificationType: string;
    requiredLeft: number;
    requiredRight: number;
    actualLeft: number;
    actualRight: number;
    consumedLeft: number;
    consumedRight: number;
    ruleVersion: number;
    rewardUsd: number;
    status: string;
    completedAt: string;
  }>;
  ladder: PromotionRule[];
  lastPromotedAt: string | null;
  lastEvaluatedAt: string | null;
}

interface PromotionSectionProps {
  data?: PromotionSummaryResponse | null;
  loading?: boolean;
}

export const PromotionSection: React.FC<PromotionSectionProps> = ({ data: legacyData, loading: legacyLoading }) => {
  const [rankState, setRankState] = useState<UserRankState | null>(null);
  const [loadingRank, setLoadingRank] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evalMessage, setEvalMessage] = useState<string | null>(null);

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

  // Fetch Authoritative Rank State
  const fetchRankState = useCallback(async () => {
    setLoadingRank(true);
    try {
      const res = await fetch('/api/promotions/ranks/me');
      const data = await res.json();
      if (res.ok && data.success) {
        setRankState(data.state);
      }
    } catch (err) {
      console.warn('[PromotionSection] Error fetching rank state:', err);
    } finally {
      setLoadingRank(false);
    }
  }, []);

  useEffect(() => {
    fetchRankState();
  }, [fetchRankState]);

  // Handle User Evaluation Request
  const handleEvaluate = async () => {
    setEvaluating(true);
    setEvalMessage(null);
    try {
      const res = await fetch('/api/promotions/ranks/evaluate', {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRankState(data.result.state);
        if (data.result.promoted) {
          setEvalMessage(`🎉 Congratulations! You have been promoted to ${data.result.currentRank}!`);
        } else {
          setEvalMessage(`Evaluation complete: ${data.result.reason}`);
        }
      } else {
        setEvalMessage(data.message || 'Evaluation could not be completed.');
      }
    } catch (err: any) {
      setEvalMessage(err.message || 'Network error evaluating promotion.');
    } finally {
      setEvaluating(false);
    }
  };

  const currentRankName = rankState?.currentRankName || 'Standard Member';
  const currentRankOrder = rankState?.currentRankOrder ?? 0;
  const nextRankName = rankState?.nextRankName;
  const matchingStage = rankState?.stageProgress.matching;
  const leadershipStage = rankState?.stageProgress.leadership;

  const totalRewardsEarned =
    rankState?.completedEvents.reduce((acc, evt) => acc + (evt.rewardUsd || 0), 0) ||
    legacyData?.totalPromotionBonusEarned ||
    0;

  return (
    <div className="p-6 rounded-2xl bg-[#0B1528]/80 border border-white/[0.08] backdrop-blur-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide">Sequential Promotion &amp; Leadership Ladder</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                Sequential Progression
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Authoritative rank ladder evaluated step-by-step. Matching units flush per stage; leadership requires qualified downline leaders.
            </p>
          </div>
        </div>

        {/* Current Rank & Rewards Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center space-x-2.5 px-3.5 py-2 rounded-xl bg-[#07101D] border border-white/10 text-white">
            <ShieldCheck className="w-5 h-5 text-[#00CFFF]" />
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Current Rank</div>
              <div className="text-sm font-bold font-mono text-[#00CFFF]">
                {currentRankName} <span className="text-xs text-slate-500">#{currentRankOrder}</span>
              </div>
            </div>
          </div>

          {totalRewardsEarned > 0 && (
            <div className="flex items-center space-x-2.5 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300">
              <Award className="w-5 h-5 text-amber-400" />
              <div>
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Milestone Rewards</div>
                <div className="text-sm font-bold font-mono text-amber-300">{formatUsd(totalRewardsEarned)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {evalMessage && (
        <div className="p-3.5 rounded-xl bg-[#07101D] border border-amber-500/30 text-xs font-mono text-amber-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{evalMessage}</span>
          </div>
          <button
            onClick={() => setEvalMessage(null)}
            className="text-slate-400 hover:text-white text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Current Active Target Stage Spotlight */}
      {nextRankName ? (
        <div className="p-5 rounded-xl bg-gradient-to-br from-[#07101D] to-[#121626] border border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold">
                Next Promotion Stage Target:
              </span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                {nextRankName}
              </span>
              <span className="text-xs font-mono text-slate-500">
                ({rankState?.qualificationType === 'MATCHING' ? 'Volume Matching' : 'Leadership Downline'})
              </span>
            </div>

            <button
              onClick={handleEvaluate}
              disabled={evaluating || loadingRank}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${evaluating ? 'animate-spin' : ''}`} />
              <span>{evaluating ? 'Evaluating...' : 'Check & Evaluate Rank'}</span>
            </button>
          </div>

          {/* If Target is MATCHING based (Node Builder, Node Master, Node Captain) */}
          {matchingStage && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Leg Progress */}
                <div className="p-3.5 rounded-lg bg-[#07101D] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">LEFT Matching Progress</span>
                    <span className="text-cyan-400 font-bold">
                      {matchingStage.leftProgress} / {matchingStage.requiredLeft} Units
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (matchingStage.leftProgress / matchingStage.requiredLeft) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>Active Volume: {matchingStage.totalActiveVolumeLeft}</span>
                    <span>Consumed Prior: {matchingStage.cumulativeConsumedLeft}</span>
                  </div>
                </div>

                {/* Right Leg Progress */}
                <div className="p-3.5 rounded-lg bg-[#07101D] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">RIGHT Matching Progress</span>
                    <span className="text-emerald-400 font-bold">
                      {matchingStage.rightProgress} / {matchingStage.requiredRight} Units
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                      style={{
                        width: `${Math.min(100, (matchingStage.rightProgress / matchingStage.requiredRight) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>Active Volume: {matchingStage.totalActiveVolumeRight}</span>
                    <span>Consumed Prior: {matchingStage.cumulativeConsumedRight}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono text-slate-400 pt-1">
                <span>
                  Stage Requirement: <strong>{matchingStage.requiredLeft} Left / {matchingStage.requiredRight} Right</strong> matching units.
                </span>
                <span className="text-amber-300 font-bold">
                  Overall Stage Completion: {matchingStage.progressPct}%
                </span>
              </div>
            </div>
          )}

          {/* If Target is LEADERSHIP based (Node Commander, Node Ambassador, Node Titan) */}
          {leadershipStage && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-[#07101D] border border-purple-500/20 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-purple-400 font-bold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Downline Leadership Requirement: {leadershipStage.requiredLeft} / {leadershipStage.requiredRight} Qualified {leadershipStage.requiredLeaderRankName} Leaders
                  </span>
                  <span className="text-purple-300 font-bold">
                    {leadershipStage.progressPct}% Qualified
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-[#0B1528] border border-white/5">
                    <div className="text-slate-400">LEFT Binary Leg Leaders</div>
                    <div className="text-xl font-bold font-mono text-purple-300 mt-1">
                      {leadershipStage.leftLeaders} <span className="text-xs text-slate-500">Qualified</span>
                    </div>
                    {leadershipStage.leftLeaderDetails.length > 0 ? (
                      <div className="text-[10px] text-slate-400 mt-1 truncate">
                        Leaders: {leadershipStage.leftLeaderDetails.map((l) => l.publicId).join(', ')}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 mt-1">
                        Awaiting downline {leadershipStage.requiredLeaderRankName} completion.
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-[#0B1528] border border-white/5">
                    <div className="text-slate-400">RIGHT Binary Leg Leaders</div>
                    <div className="text-xl font-bold font-mono text-purple-300 mt-1">
                      {leadershipStage.rightLeaders} <span className="text-xs text-slate-500">Qualified</span>
                    </div>
                    {leadershipStage.rightLeaderDetails.length > 0 ? (
                      <div className="text-[10px] text-slate-400 mt-1 truncate">
                        Leaders: {leadershipStage.rightLeaderDetails.map((l) => l.publicId).join(', ')}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-500 mt-1">
                        Awaiting downline {leadershipStage.requiredLeaderRankName} completion.
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
                    style={{ width: `${leadershipStage.progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-[#07101D] border border-emerald-500/30 flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
          <div>
            <div className="text-base font-bold font-mono text-white">Supreme Node Titan Achieved</div>
            <div className="text-xs text-slate-400">
              You have completed all sequential promotion ranks up to Rank 6 (Node Titan).
            </div>
          </div>
        </div>
      )}

      {/* The 7-Rank Progression Ladder */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
            Official Promotion Ladder Sequence
          </span>
          <span className="text-slate-500 lowercase">Rank 0 through Rank 6</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(rankState?.ladder || []).map((rule) => {
            const isCompleted = currentRankOrder >= rule.rankOrder;
            const isCurrentTarget = nextRankName === rule.rankKey;
            const isLocked = currentRankOrder < rule.rankOrder && !isCurrentTarget;

            return (
              <div
                key={rule.rankKey}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCompleted
                    ? 'bg-gradient-to-br from-emerald-500/10 to-[#07101D] border-emerald-500/30'
                    : isCurrentTarget
                    ? 'bg-gradient-to-br from-amber-500/10 to-[#07101D] border-amber-500/40 shadow-lg shadow-amber-500/5'
                    : 'bg-[#07101D] border-white/5 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className="text-xs font-mono font-bold text-white">#{rule.rankOrder} {rule.rankName}</span>
                  {isCompleted ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold">
                      <Check className="w-3 h-3" /> COMPLETED
                    </span>
                  ) : isCurrentTarget ? (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-amber-400 font-bold animate-pulse">
                      <Zap className="w-3 h-3" /> PENDING TARGET
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                      <Lock className="w-3 h-3" /> LOCKED
                    </span>
                  )}
                </div>

                <div className="pt-2.5 pb-2 text-xs font-mono space-y-1">
                  <div className="text-[11px] text-slate-400">
                    Type: <strong className="text-slate-200">{rule.qualificationType}</strong>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    {rule.qualificationType === 'MATCHING'
                      ? `${rule.requiredLeft}L / ${rule.requiredRight}R Matching Units`
                      : rule.qualificationType === 'LEADERSHIP'
                      ? `${rule.requiredLeft} / ${rule.requiredRight} ${rule.requiredLeaderRank} Leaders`
                      : 'Default Tier'}
                  </div>
                  {rule.rewardUsd > 0 && (
                    <div className="text-[11px] font-bold text-amber-300">
                      Bonus: {formatUsd(rule.rewardUsd)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completed Rank Achievements History */}
      {rankState && rankState.completedEvents.length > 0 && (
        <div className="p-4 rounded-xl bg-[#07101D] border border-white/10 space-y-3">
          <div className="text-xs font-mono uppercase text-slate-400 tracking-wider border-b border-white/5 pb-2 flex items-center justify-between">
            <span>Authoritative Rank History</span>
            <span className="text-[10px] text-slate-500">{rankState.completedEvents.length} Achieved</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="text-slate-500 border-b border-white/5 text-[10px]">
                  <th className="py-2 px-2">Promotion ID</th>
                  <th className="py-2 px-2">Rank Achieved</th>
                  <th className="py-2 px-2">Order</th>
                  <th className="py-2 px-2">Type</th>
                  <th className="py-2 px-2">Consumed Matching Units</th>
                  <th className="py-2 px-2">Milestone Reward</th>
                  <th className="py-2 px-2">Rule Version</th>
                  <th className="py-2 px-2">Date Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {rankState.completedEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-white/[0.02]">
                    <td className="py-2.5 px-2 text-[#00CFFF]">{evt.publicPromotionId}</td>
                    <td className="py-2.5 px-2 font-bold text-white">{evt.rankName}</td>
                    <td className="py-2.5 px-2 text-slate-400">#{evt.rankOrder}</td>
                    <td className="py-2.5 px-2 text-slate-300">{evt.qualificationType}</td>
                    <td className="py-2.5 px-2 text-slate-300">{evt.consumedLeft} Left / {evt.consumedRight} Right</td>
                    <td className="py-2.5 px-2 text-amber-300 font-bold">{evt.rewardUsd > 0 ? formatUsd(evt.rewardUsd) : '—'}</td>
                    <td className="py-2.5 px-2 text-slate-400">v{evt.ruleVersion}</td>
                    <td className="py-2.5 px-2 text-slate-400">{formatDate(evt.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Regulatory & Compliance Notice */}
      <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-slate-400 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p>
          PHIVONEX promotion ranks are awarded sequentially based on verified network binary matching volume and downline validator leadership qualification. Promotion progression does not represent an investment, yield, or guarantee of financial returns.
        </p>
      </div>
    </div>
  );
};
