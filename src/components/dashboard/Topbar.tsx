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
  Check
} from 'lucide-react';
import { PhivonexLogo } from '../brand/PhivonexLogo';
import { PhivonexSymbol } from '../brand/PhivonexSymbol';
import { UserProfile } from '../../context/AuthContext';
import { DashboardTab } from './Sidebar';

interface TopbarProps {
  user: UserProfile | null;
  activeTab: DashboardTab;
  onOpenMobileMenu: () => void;
  onSelectTab: (tab: DashboardTab) => void;
  onLogout: () => Promise<void>;
  onNavigate: (route: string) => void;
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
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
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

      {/* Right Area: Public Portal Link + Network Status + User Menu */}
      <div className="flex items-center gap-2 sm:gap-4">
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
