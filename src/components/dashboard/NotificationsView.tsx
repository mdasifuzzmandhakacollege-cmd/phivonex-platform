import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  CheckCheck,
  Check,
  Filter,
  Server,
  Users,
  GitFork,
  Coins,
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
  Clock,
  RefreshCw,
  Inbox,
  AlertCircle
} from 'lucide-react';
import { UserProfile } from '../../context/AuthContext';
import { DashboardTab } from './Sidebar';

export interface AppNotification {
  id: string; // public_notification_id (NTF-XXXXXX)
  type:
    | 'NODE_ACTIVATED'
    | 'REFERRAL_EARNED'
    | 'MATCHING_EARNED'
    | 'PROMOTION_EARNED'
    | 'PHIVO_REWARD'
    | 'PHIVO_SWAP_COMPLETED'
    | 'USDT_DEPOSIT_CONFIRMED'
    | 'WITHDRAWAL_STATUS'
    | 'SECURITY_ALERT';
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsViewProps {
  user: UserProfile;
  onNavigateTab?: (tab: DashboardTab) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ user, onNavigateTab }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (unreadOnly) params.append('unreadOnly', 'true');
      if (filterType !== 'ALL') params.append('type', filterType);

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      setNotifications(data.notifications || []);
      setTotalCount(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
    } catch (err: any) {
      console.error('[NotificationsView] Failed to fetch notifications:', err);
      setError('Unable to synchronize notification stream. Please check connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterType, unreadOnly]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (publicNotificationId: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === publicNotificationId ? { ...n, readAt: new Date().toISOString() } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      const res = await fetch(`/api/notifications/${publicNotificationId}/read`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        // Revert on error
        fetchNotifications(true);
      }
    } catch {
      fetchNotifications(true);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAllRead) return;
    setMarkingAllRead(true);

    // Optimistic update
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || nowIso })));
    setUnreadCount(0);

    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
      });
    } catch (err) {
      console.warn('[NotificationsView] Error marking all read:', err);
      fetchNotifications(true);
    } finally {
      setMarkingAllRead(false);
    }
  };

  const getTypeMeta = (type: AppNotification['type']) => {
    switch (type) {
      case 'NODE_ACTIVATED':
        return {
          icon: Server,
          color: 'text-[#00CFFF]',
          bg: 'bg-[#00CFFF]/10 border-[#00CFFF]/30',
          badgeText: 'Node Infrastructure',
          destTab: 'nodes' as DashboardTab,
        };
      case 'REFERRAL_EARNED':
        return {
          icon: Users,
          color: 'text-[#32D583]',
          bg: 'bg-[#32D583]/10 border-[#32D583]/30',
          badgeText: 'Referral Bonus',
          destTab: 'referrals' as DashboardTab,
        };
      case 'MATCHING_EARNED':
        return {
          icon: GitFork,
          color: 'text-[#A855F7]',
          bg: 'bg-[#A855F7]/10 border-[#A855F7]/30',
          badgeText: 'Binary Matching',
          destTab: 'network' as DashboardTab,
        };
      case 'PROMOTION_EARNED':
        return {
          icon: CheckCheck,
          color: 'text-[#F59E0B]',
          bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/30',
          badgeText: 'Milestone Promotion',
          destTab: 'network' as DashboardTab,
        };
      case 'PHIVO_REWARD':
        return {
          icon: Coins,
          color: 'text-[#10B981]',
          bg: 'bg-[#10B981]/10 border-[#10B981]/30',
          badgeText: 'Mining Reward',
          destTab: 'rewards' as DashboardTab,
        };
      case 'PHIVO_SWAP_COMPLETED':
        return {
          icon: ArrowLeftRight,
          color: 'text-[#38BDF8]',
          bg: 'bg-[#38BDF8]/10 border-[#38BDF8]/30',
          badgeText: 'Coin Swap',
          destTab: 'swap' as DashboardTab,
        };
      case 'USDT_DEPOSIT_CONFIRMED':
        return {
          icon: ArrowDownLeft,
          color: 'text-[#32D583]',
          bg: 'bg-[#32D583]/10 border-[#32D583]/30',
          badgeText: 'BSC Deposit',
          destTab: 'deposit' as DashboardTab,
        };
      case 'WITHDRAWAL_STATUS':
        return {
          icon: ArrowUpRight,
          color: 'text-[#F97316]',
          bg: 'bg-[#F97316]/10 border-[#F97316]/30',
          badgeText: 'Withdrawal',
          destTab: 'withdrawals' as DashboardTab,
        };
      case 'SECURITY_ALERT':
        return {
          icon: ShieldAlert,
          color: 'text-[#F04438]',
          bg: 'bg-[#F04438]/10 border-[#F04438]/30',
          badgeText: 'Security Notice',
          destTab: 'security' as DashboardTab,
        };
      default:
        return {
          icon: Bell,
          color: 'text-[#98A2B3]',
          bg: 'bg-white/5 border-white/10',
          badgeText: 'System Event',
          destTab: 'overview' as DashboardTab,
        };
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      const diffDays = Math.floor(diffHrs / 24);
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00CFFF]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#00CFFF]/10 border border-[#00CFFF]/30 flex items-center justify-center text-[#00CFFF]">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>Protocol Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#00CFFF]/20 border border-[#00CFFF]/40 text-[#00CFFF] text-xs font-mono font-semibold">
                    {unreadCount} unread
                  </span>
                )}
              </h1>
              <p className="text-xs text-[#98A2B3]">
                Real-time cryptographic audit trail of node activations, commissions, matching cycles, and balances.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            onClick={() => fetchNotifications(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#98A2B3] hover:text-white transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center disabled:opacity-50"
            title="Refresh notifications"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#00CFFF]' : ''}`} />
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAllRead}
              className="py-2 px-3.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-white font-medium flex items-center gap-2 transition-colors cursor-pointer min-h-[40px] disabled:opacity-50"
            >
              <CheckCheck className="w-4 h-4 text-[#00CFFF]" />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#07101D] border border-white/[0.08]">
        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
          {[
            { id: 'ALL', label: 'All Events' },
            { id: 'NODE_ACTIVATED', label: 'Nodes' },
            { id: 'REFERRAL_EARNED', label: 'Referrals' },
            { id: 'MATCHING_EARNED', label: 'Matching' },
            { id: 'PROMOTION_EARNED', label: 'Promotions' },
            { id: 'PHIVO_REWARD', label: 'Mining' },
            { id: 'PHIVO_SWAP_COMPLETED', label: 'Swaps' },
            { id: 'USDT_DEPOSIT_CONFIRMED', label: 'Deposits' },
            { id: 'WITHDRAWAL_STATUS', label: 'Withdrawals' },
            { id: 'SECURITY_ALERT', label: 'Security' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterType(cat.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-all cursor-pointer ${
                filterType === cat.id
                  ? 'bg-[#00CFFF] text-[#05070B] font-bold shadow-sm'
                  : 'bg-white/[0.02] text-[#98A2B3] hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Unread Toggle */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[#98A2B3] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#00CFFF] focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <span className={unreadOnly ? 'text-white font-medium' : ''}>Unread only</span>
          </label>
        </div>
      </div>

      {/* Notifications List */}
      {error ? (
        <div className="p-8 rounded-2xl bg-[#07101D] border border-[#F04438]/30 flex flex-col items-center justify-center text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-[#F04438]" />
          <p className="text-sm text-white font-medium">{error}</p>
          <button
            onClick={() => fetchNotifications()}
            className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs text-white font-medium cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : loading && !refreshing ? (
        <div className="p-16 rounded-2xl bg-[#07101D] border border-white/[0.08] flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-6 h-6 text-[#00CFFF] animate-spin" />
          <p className="text-xs font-mono text-[#98A2B3]">Fetching cryptographically signed alerts...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-16 rounded-2xl bg-[#07101D] border border-white/[0.08] flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center text-[#98A2B3]">
            <Inbox className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-white">No Notifications Found</h3>
          <p className="text-xs text-[#98A2B3] max-w-sm">
            {unreadOnly
              ? 'You have caught up with all incoming system events! No unread notifications.'
              : 'There are no notifications matching your current filter criteria.'}
          </p>
          {unreadOnly && (
            <button
              onClick={() => setUnreadOnly(false)}
              className="text-xs text-[#00CFFF] hover:underline cursor-pointer pt-1"
            >
              Show all notifications
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => {
            const meta = getTypeMeta(notif.type);
            const IconComponent = meta.icon;
            const isUnread = !notif.readAt;

            return (
              <div
                key={notif.id}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start justify-between gap-4 ${
                  isUnread
                    ? 'bg-[#0B1527] border-[#00CFFF]/30 shadow-lg shadow-[#00CFFF]/5'
                    : 'bg-[#07101D] border-white/[0.06] hover:border-white/[0.12]'
                }`}
              >
                <div className="flex items-start gap-3.5 w-full sm:w-auto">
                  {/* Type Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl border flex-shrink-0 flex items-center justify-center ${meta.bg} ${meta.color}`}
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>

                  {/* Body Content */}
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
                        {meta.badgeText}
                      </span>
                      <span className="text-[11px] font-mono text-[#98A2B3]">
                        {notif.id}
                      </span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-[#00CFFF] animate-pulse" title="Unread" />
                      )}
                    </div>

                    <h4 className={`text-sm font-bold tracking-tight ${isUnread ? 'text-white' : 'text-[#E0E6ED]'}`}>
                      {notif.title}
                    </h4>

                    <p className="text-xs text-[#98A2B3] leading-relaxed">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-[#98A2B3] font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 opacity-60" />
                        <span>{formatRelativeTime(notif.createdAt)}</span>
                      </span>
                      <span>•</span>
                      <span>{new Date(notif.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Actions on right */}
                <div className="flex items-center gap-2 self-end sm:self-center w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.04]">
                  {onNavigateTab && (
                    <button
                      onClick={() => onNavigateTab(meta.destTab)}
                      className="px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-[#98A2B3] hover:text-white font-medium transition-colors cursor-pointer"
                    >
                      View Details
                    </button>
                  )}

                  {isUnread && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#00CFFF]/10 hover:bg-[#00CFFF]/20 border border-[#00CFFF]/30 text-xs text-[#00CFFF] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark read</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
