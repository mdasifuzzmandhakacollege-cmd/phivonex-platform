import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  LogOut,
  User,
  ShieldCheck,
  ChevronDown,
  ExternalLink,
  Shield,
  Activity,
  Check,
  Bell,
  CheckCheck,
  Clock,
  ArrowRight,
  Volume2,
  VolumeX
} from 'lucide-react';
import { PhivonexLogo } from '../brand/PhivonexLogo';
import { PhivonexSymbol } from '../brand/PhivonexSymbol';
import { UserProfile } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { DashboardTab } from './Sidebar';
import { PWAInstallHeaderButton } from '../PWAInstallPrompt';

interface TopbarProps {
  user: UserProfile | null;
  activeTab: DashboardTab;
  onOpenMobileMenu: () => void;
  onSelectTab: (tab: DashboardTab) => void;
  onLogout: () => Promise<void>;
  onNavigate: (route: string) => void;
}

interface RecentNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export const Topbar: React.FC<TopbarProps> = ({
  user,
  activeTab,
  onOpenMobileMenu,
  onSelectTab,
  onLogout,
  onNavigate,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  
  const {
    unreadCount,
    notifications,
    loading: loadingNotifs,
    audioEnabled,
    toggleAudio,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
  } = useNotifications();

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const handleToggleNotif = () => {
    if (!isNotifOpen) {
      refreshNotifications();
      setIsUserMenuOpen(false);
    }
    setIsNotifOpen(!isNotifOpen);
  };

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await markAsRead(id);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  // Recent 5 notifications for the preview dropdown
  const recentNotifications = notifications.slice(0, 5);

  const isAdmin = Boolean(
    user && (
      user.isAdmin === true ||
      (user.role || '').toUpperCase() === 'ADMIN' ||
      (user.role || '').toUpperCase() === 'SUPER_ADMIN' ||
      user.email?.toLowerCase().trim() === 'md.asifuzzman.dhakacollege@gmail.com' ||
      user.email?.toLowerCase().trim() === 'admin@phivonex.com'
    )
  );

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const getPageTitle = (tab: DashboardTab) => {
    switch (tab) {
      case 'overview':
        return 'Network Overview';
      case 'nodes':
        return 'Node Infrastructure';
      case 'network':
        return 'Network Topology';
      case 'referrals':
        return 'Direct Referrals';
      case 'wallet':
        return 'Wallet & Ledger';
      case 'swap':
        return 'Internal Coin Swap';
      case 'deposit':
        return 'BNB & USDT Deposit Portal';
      case 'withdrawals':
        return 'Asset Withdrawals';
      case 'notifications':
        return 'Protocol Notifications';
      case 'rewards':
        return 'Rewards & Mining Ledger';
      case 'transactions':
        return 'Ledger Transactions';
      case 'profile':
        return 'Operator Profile';
      case 'security':
        return 'Security & Sessions';
      default:
        return 'Dashboard';
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'OP';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-[#07101D]/90 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 flex items-center justify-between">
      {/* Left Area: Mobile Menu Trigger + Logo + Breadcrumb / Title */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-[#98A2B3] hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Open mobile navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile Logo (hidden on lg where sidebar has logo) */}
        <div className="lg:hidden flex items-center">
          <button
            onClick={() => onNavigate('/')}
            className="flex items-center gap-1.5 focus:outline-none cursor-pointer"
            aria-label="PHIVONEX Home"
          >
            <PhivonexSymbol size={26} />
          </button>
        </div>

        {/* Page Title & Breadcrumb */}
        <div className="flex items-center gap-2">
          <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
            {getPageTitle(activeTab)}
          </h1>
          <span className="hidden sm:inline-block text-xs font-mono text-[#00CFFF] bg-[#00CFFF]/10 border border-[#00CFFF]/20 px-2 py-0.5 rounded-full">
            Protocol Live
          </span>
        </div>
      </div>

      {/* Right Area: Public Portal Link + PWA Install + Network Status + User Menu */}
      <div className="flex items-center gap-2 sm:gap-4">
        <PWAInstallHeaderButton />

        {/* Public Portal link */}
        <button
          onClick={() => onNavigate('/')}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-xs text-[#98A2B3] hover:text-white font-medium transition-colors cursor-pointer min-h-[36px]"
          title="Return to Public Presentation"
        >
          <span>Public Portal</span>
          <ExternalLink className="w-3 h-3 text-white/40" />
        </button>

        {/* Security indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#32D583]/[0.08] border border-[#32D583]/20 text-[11px] font-mono text-[#32D583]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>TLS 1.3 Verified</span>
        </div>

        {/* Task #20: Notification Bell + Dropdown */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={handleToggleNotif}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer relative min-h-[44px] min-w-[44px] flex items-center justify-center ${
              isNotifOpen
                ? 'bg-white/[0.08] border-[#00CFFF]/40 text-white'
                : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/[0.08] text-[#98A2B3] hover:text-white'
            }`}
            aria-label="Notifications"
            aria-expanded={isNotifOpen}
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#00CFFF] text-[#05070B] text-[10px] font-mono font-bold flex items-center justify-center shadow-lg shadow-[#00CFFF]/40 animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Preview */}
          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#07101D] border border-white/[0.12] shadow-2xl p-3 z-50 animate-fadeIn">
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-white/[0.08] px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white tracking-tight">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#00CFFF]/20 border border-[#00CFFF]/40 text-[#00CFFF] text-[10px] font-mono font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Subtle Audio Alert Awareness Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAudio();
                    }}
                    className={`p-1 rounded-md text-xs transition-colors cursor-pointer flex items-center gap-1 ${
                      audioEnabled
                        ? 'text-[#00CFFF] bg-[#00CFFF]/10 hover:bg-[#00CFFF]/20'
                        : 'text-[#98A2B3] hover:text-white bg-white/[0.04] hover:bg-white/[0.08]'
                    }`}
                    title={audioEnabled ? 'Audio alerts: Active (Click to Mute)' : 'Audio alerts: Muted (Click to Enable)'}
                    aria-label="Toggle audio alerts"
                  >
                    {audioEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>

                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-[#00CFFF] hover:text-[#00CFFF]/80 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all read</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Notification preview list */}
              <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1 scrollbar-none">
                {loadingNotifs ? (
                  <div className="py-8 text-center text-xs text-[#98A2B3] font-mono flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-[#00CFFF] border-t-transparent rounded-full animate-spin" />
                    <span>Loading alerts...</span>
                  </div>
                ) : recentNotifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#98A2B3]">
                    No notifications yet.
                  </div>
                ) : (
                  recentNotifications.map((notif) => {
                    const isUnread = !notif.readAt;
                    return (
                      <div
                        key={notif.id}
                        onClick={() => {
                          onSelectTab('notifications');
                          setIsNotifOpen(false);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isUnread
                            ? 'bg-[#0B1527] border-[#00CFFF]/30 hover:border-[#00CFFF]/50'
                            : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isUnread && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00CFFF] flex-shrink-0" />
                            )}
                            <h5 className={`text-xs font-semibold truncate ${isUnread ? 'text-white' : 'text-[#D0D5DD]'}`}>
                              {notif.title}
                            </h5>
                          </div>
                          {isUnread && (
                            <button
                              onClick={(e) => handleMarkAsRead(notif.id, e)}
                              className="text-[10px] text-[#00CFFF] hover:text-white px-1.5 py-0.5 rounded bg-[#00CFFF]/10 hover:bg-[#00CFFF]/20 transition-colors flex-shrink-0"
                              title="Mark read"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] text-[#98A2B3] line-clamp-2 mt-0.5">
                          {notif.message}
                        </p>
                        <div className="flex items-center gap-1 text-[10px] text-[#98A2B3] font-mono mt-1">
                          <Clock className="w-2.5 h-2.5 opacity-60" />
                          <span>{new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* View all footer */}
              <div className="pt-2 mt-2 border-t border-white/[0.08]">
                <button
                  onClick={() => {
                    onSelectTab('notifications');
                    setIsNotifOpen(false);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>View All in Notification Center</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#00CFFF]" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Admin Quick Action Button */}
        {isAdmin && (
          <button
            onClick={() => onNavigate('/admin')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#F04438]/20 via-[#FF8C00]/20 to-[#00CFFF]/20 hover:from-[#F04438]/30 hover:to-[#00CFFF]/30 border border-[#F04438]/50 text-white text-xs font-bold transition-all cursor-pointer shadow-md hover:shadow-[#F04438]/20 active:scale-95"
            title="Open Admin Control Plane"
          >
            <Shield className="w-3.5 h-3.5 text-[#F04438]" />
            <span className="hidden sm:inline">Admin Panel</span>
          </button>
        )}

        {/* User Menu Dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] transition-all cursor-pointer min-h-[44px]"
            aria-expanded={isUserMenuOpen}
            aria-haspopup="true"
            aria-label="User account menu"
          >
            {/* Operator Avatar */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00CFFF]/20 to-[#168BFF]/20 border border-[#00CFFF]/40 flex items-center justify-center text-xs font-mono font-bold text-[#00CFFF]">
              {getInitials(user?.fullName)}
            </div>

            {/* User Info (hidden on very small screens) */}
            <div className="hidden sm:block text-left max-w-[130px]">
              <div className="text-xs font-semibold text-white truncate">
                {user?.fullName || 'Operator'}
              </div>
              <div className="text-[10px] font-mono text-[#98A2B3] truncate">
                {user?.publicId || 'PHX-OPERATOR'}
              </div>
            </div>

            <ChevronDown className={`w-3.5 h-3.5 text-[#98A2B3] transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* User Menu Dropdown Box */}
          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#07101D] border border-white/[0.12] shadow-2xl p-2 z-50 animate-fadeIn">
              {/* Profile Header Box */}
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white truncate block">
                    {user?.fullName || 'Operator'}
                  </span>
                  <span className="text-[10px] font-mono text-[#32D583] bg-[#32D583]/10 px-2 py-0.5 rounded border border-[#32D583]/20">
                    {user?.status || 'ACTIVE'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[#00CFFF]">
                  {user?.publicId || 'PHX-OPERATOR'}
                </div>
                <div className="text-[10px] text-[#98A2B3] truncate">
                  {user?.email || ''}
                </div>
              </div>

              {/* Navigation Options */}
              <div className="space-y-0.5">
                {isAdmin && (
                  <button
                    onClick={() => {
                      onNavigate('/admin');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#F04438] bg-[#F04438]/10 hover:bg-[#F04438]/20 border border-[#F04438]/20 transition-colors cursor-pointer min-h-[40px] font-bold mb-1"
                  >
                    <Shield className="w-4 h-4 text-[#F04438]" />
                    <span>Admin Control Plane</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    onSelectTab('profile');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#98A2B3] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer min-h-[40px]"
                >
                  <User className="w-4 h-4 text-[#00CFFF]" />
                  <span>Account Profile</span>
                </button>

                <button
                  onClick={() => {
                    onSelectTab('security');
                    setIsUserMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#98A2B3] hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer min-h-[40px]"
                >
                  <ShieldCheck className="w-4 h-4 text-[#168BFF]" />
                  <span>Security &amp; Sessions</span>
                </button>

                <div className="my-1.5 border-t border-white/[0.08]" />

                {/* Logout Button */}
                <button
                  onClick={async () => {
                    setIsUserMenuOpen(false);
                    await onLogout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-[#F04438] hover:bg-[#F04438]/10 transition-colors cursor-pointer min-h-[40px] font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
