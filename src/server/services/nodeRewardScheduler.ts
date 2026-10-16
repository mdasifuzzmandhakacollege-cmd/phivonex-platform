import { getNextUtc0600Time, getPreviousUtcBusinessDate } from '../utils/timezone';
import {
  getRewardDistributionMode,
  executeDailyRewardDistribution,
} from './nodeRewardService';

let rewardSchedulerTimer: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Executes daily node mining reward distribution if AUTOMATIC mode is active.
 * If mode is MANUAL, it skips automatic settlement and waits for admin action.
 */
async function executeDailyRewardCycle(): Promise<void> {
  const previousDate = getPreviousUtcBusinessDate();
  console.log(`[NodeRewardScheduler] 🕛 Daily settlement trigger point reached for business date: ${previousDate}`);

  try {
    const mode = await getRewardDistributionMode();
    if (mode === 'MANUAL') {
      console.log('[NodeRewardScheduler] ⏸️ Reward distribution is set to MANUAL mode. Skipping automatic distribution.');
      return;
    }

    console.log('[NodeRewardScheduler] 🚀 AUTOMATIC mode active. Starting daily node mining reward distribution...');
    const result = await executeDailyRewardDistribution({
      triggeredBy: 'AUTOMATIC_SCHEDULER',
    });

    if (result.success) {
      console.log(
        `[NodeRewardScheduler] ✅ Daily rewards distributed: Epoch #${result.epochNumber} (${result.publicEpochId}), ` +
        `Eligible Nodes=${result.eligibleNodesCount}, Rewards Created=${result.rewardsCreated}, Total Distributed=${result.totalRewardsDistributedUsd}`
      );
    } else {
      console.warn(`[NodeRewardScheduler] Notice during automatic reward distribution: ${result.message || result.error}`);
    }
  } catch (err) {
    console.error('[NodeRewardScheduler] ❌ Daily reward distribution cycle failed:', err);
  } finally {
    scheduleNextRewardRun();
  }
}

/**
 * Schedules the next check for the daily reward run (aligned to 06:00 UTC cycle)
 */
function scheduleNextRewardRun(): void {
  const { nextRunIso, msUntilRun } = getNextUtc0600Time();
  console.log(`[NodeRewardScheduler] Next automatic reward check scheduled for ${nextRunIso} (in ${Math.round(msUntilRun / 1000)}s)`);

  if (rewardSchedulerTimer) {
    clearTimeout(rewardSchedulerTimer);
  }

  rewardSchedulerTimer = setTimeout(() => {
    executeDailyRewardCycle().catch((err) => {
      console.error('[NodeRewardScheduler] Unhandled error during scheduled run:', err);
    });
  }, msUntilRun);
}

/**
 * Initializes the background daily node reward scheduler.
 */
export function startNodeRewardScheduler(): void {
  if (isRunning) return;
  isRunning = true;
  console.log('[NodeRewardScheduler] Initializing Daily Node Reward (ROI) Distribution Scheduler...');
  scheduleNextRewardRun();
}

/**
 * Stops the background scheduler (for testing or shutdown).
 */
export function stopNodeRewardScheduler(): void {
  if (rewardSchedulerTimer) {
    clearTimeout(rewardSchedulerTimer);
    rewardSchedulerTimer = null;
  }
  isRunning = false;
  console.log('[NodeRewardScheduler] Stopped Daily Node Reward Scheduler.');
}
