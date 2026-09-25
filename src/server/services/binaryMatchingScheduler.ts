import { getNextDhakaMidnightTime, getPreviousDhakaBusinessDate } from '../utils/timezone';
import { runDailyMatchingSettlementCycle } from './binaryMatchingService';

let schedulerTimer: NodeJS.Timeout | null = null;
let isRunning = false;

/**
 * Executes the authoritative midnight settlement cycle.
 * Settles the previous business date that just closed at 00:00 Asia/Dhaka.
 */
async function executeMidnightCycle(): Promise<void> {
  const previousDate = getPreviousDhakaBusinessDate();
  console.log(`[MatchingScheduler] 🕛 00:00 Asia/Dhaka reached. Starting settlement for previous business date: ${previousDate}`);

  try {
    const result = await runDailyMatchingSettlementCycle(previousDate);
    console.log(
      `[MatchingScheduler] ✅ Midnight settlement cycle finished for ${previousDate}: ` +
      `status=${result.status}, usersSettled=${result.usersSettled}, totalBonus=$${result.totalBonusUsd}, duration=${result.durationMs}ms`
    );
  } catch (err) {
    console.error(`[MatchingScheduler] ❌ Midnight settlement cycle failed for ${previousDate}:`, err);
  } finally {
    // Schedule next cycle
    scheduleNextMidnightRun();
  }
}

/**
 * Calculates ms until the next 00:00 Asia/Dhaka and arms the timer.
 */
function scheduleNextMidnightRun(): void {
  const { nextMidnightIso, msUntilMidnight } = getNextDhakaMidnightTime();
  console.log(`[MatchingScheduler] Next daily settlement scheduled for ${nextMidnightIso} (in ${Math.round(msUntilMidnight / 1000)}s)`);

  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
  }

  // Max setTimeout in Node.js is 2147483647 ms (~24.8 days)
  // Asia/Dhaka midnight is at most 24 hours away (~86,400,000 ms), completely safe.
  schedulerTimer = setTimeout(() => {
    executeMidnightCycle().catch((err) => {
      console.error('[MatchingScheduler] Unhandled error during midnight execution:', err);
    });
  }, msUntilMidnight);
}

/**
 * Initializes the background midnight matching scheduler.
 */
export function startMatchingScheduler(): void {
  if (isRunning) return;
  isRunning = true;
  console.log('[MatchingScheduler] Initializing Daily Binary Matching Settlement Scheduler (Asia/Dhaka)...');
  scheduleNextMidnightRun();
}

/**
 * Stops the background scheduler (e.g. during graceful shutdown or testing).
 */
export function stopMatchingScheduler(): void {
  if (schedulerTimer) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
  isRunning = false;
  console.log('[MatchingScheduler] Stopped Daily Binary Matching Settlement Scheduler.');
}
