import React from 'react';
import {
  LayoutDashboard,
  Server,
  Network,
  Coins,
  ArrowLeftRight,
  User,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Radio,
  Users,
  GitFork,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Bell,
  X
} from 'lucide-react';
import { PhivonexLogo } from '../brand/PhivonexLogo';
import { PhivonexSymbol } from '../brand/PhivonexSymbol';

export type DashboardTab =
  | 'overview'
  | 'nodes'
  | 'network'
  | 'referrals'
  | 'wallet'
  | 'swap'
  | 'deposit'
  | 'withdrawals'
  | 'notifications'
  | 'rewards'
  | 'transactions'
  | 'profile'
  | 'security';

interface SidebarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  publicId?: string;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}

interface NavItem {
  id: DashboardTab;
  label: string;
  icon: React.ElementType;
  comingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'nodes', label: 'My Nodes', icon: Server },
  { id: 'network', label: 'Network', icon: GitFork },
  { id: 'referrals', label: 'Direct Referrals', icon: Users },
  { id: 'wallet', label: 'Wallet & Ledger', icon: Wallet },
  { id: 'swap', label: 'Coin Swap', icon: ArrowLeftRight },
  { id: 'deposit', label: 'BNB Deposit', icon: ArrowDownLeft },
  { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpRight },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'rewards', label: 'Rewards', icon: Coins, comingSoon: true },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: ShieldCheck },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  publicId,
  isMobile = false,
  onCloseMobile,
}) => {
  return (
    <aside
      className={`flex flex-col justify-between h-full bg-[#07101D] border-r border-white/[0.08] ${
        isMobile ? 'w-full px-4 py-6' : 'w-64 px-4 py-6 select-none'
      }`}
    >
      {/* Top Section: Logo & Mobile Close */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <PhivonexLogo size="md" />
          </div>

          {isMobile && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#98A2B3] hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation List */}
        <nav className="space-y-1" aria-label="Dashboard Navigation">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-[#98A2B3]">
            Protocol Navigation
          </div>

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (isMobile && onCloseMobile) {
                    onCloseMobile();
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer min-h-[44px] group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#00CFFF]/15 to-[#168BFF]/10 text-white border border-[#00CFFF]/30 shadow-sm shadow-[#00CFFF]/10'
                    : 'text-[#98A2B3] hover:text-white hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-[#00CFFF]/20 text-[#00CFFF]'
                        : 'bg-white/[0.03] text-[#98A2B3] group-hover:text-white group-hover:bg-white/[0.06]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="truncate">{item.label}</span>
                </div>

                {item.comingSoon ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.05] text-[#98A2B3] border border-white/[0.08] group-hover:border-white/[0.15]">
                    Soon
                  </span>
                ) : isActive ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#00CFFF] shadow-sm shadow-[#00CFFF]" />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section: Network Node Telemetry & Public ID */}
      <div className="space-y-3 pt-6 border-t border-white/[0.08]">
        {/* Node Telemetry Card */}
        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 text-[#32D583] font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#32D583] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#32D583]"></span>
              </span>
              <span>Mainnet Beta</span>
            </div>
            <span className="text-[10px] font-mono text-[#98A2B3]">TLS 1.3</span>
          </div>

          <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-[#98A2B3] border-t border-white/[0.04]">
            <span>Operator ID:</span>
            <span className="text-white font-semibold truncate ml-1">{publicId || 'PHX-OPERATOR'}</span>
          </div>
        </div>

        {/* Security & Version info */}
        <div className="flex items-center justify-between px-2 text-[10px] font-mono text-white/40">
          <span>PHIVONEX v1.0.4</span>
          <span className="flex items-center gap-1">
            <Radio className="w-2.5 h-2.5 text-[#00CFFF]" />
            Live Sync
          </span>
        </div>
      </div>
    </aside>
  );
};
