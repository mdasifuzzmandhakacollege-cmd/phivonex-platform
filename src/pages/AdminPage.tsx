import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  Users,
  Server,
  ShoppingBag,
  ArrowUpRight,
  ArrowLeftRight,
  GitFork,
  FileText,
  LayoutDashboard,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Lock,
  ChevronRight,
  ShieldCheck,
  DollarSign,
  Info
} from 'lucide-react';
import { PhivonexLogo } from '../components/brand/PhivonexLogo';
import { WithdrawalManagement } from '../components/admin/WithdrawalManagement';

interface AdminPageProps {
  onNavigate: (route: string) => void;
  currentPath?: string;
}

export type AdminTab =
  | 'overview'
  | 'users'
  | 'nodes'
  | 'orders'
  | 'withdrawals'
  | 'transactions'
  | 'network'
  | 'audit';

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigate, currentPath = '/admin' }) => {
  const { user, loading } = useAuth();

  const getTabFromPath = (path: string): AdminTab => {
    const clean = path.toLowerCase().split('?')[0];
    if (clean.includes('/users')) return 'users';
    if (clean.includes('/nodes')) return 'nodes';
    if (clean.includes('/orders')) return 'orders';
    if (clean.includes('/withdrawals')) return 'withdrawals';
    if (clean.includes('/transactions')) return 'transactions';
    if (clean.includes('/network')) return 'network';
    if (clean.includes('/audit')) return 'audit';
    return 'overview';
  };

  const [activeTab, setActiveTab] = useState<AdminTab>(() => getTabFromPath(currentPath));

  // Admin Data states
  const [summary, setSummary] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [nodesList, setNodesList] = useState<any[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  const [withdrawalsList, setWithdrawalsList] = useState<any[]>([]);
  const [transactionsList, setTransactionsList] = useState<any[]>([]);
  const [auditList, setAuditList] = useState<any[]>([]);

  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [accessDenied, setAccessDenied] = useState<boolean>(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Sync tab with URL
  useEffect(() => {
    const matched = getTabFromPath(currentPath);
    if (matched !== activeTab) {
      setActiveTab(matched);
    }
  }, [currentPath]);

  // Fetch Admin Data
  const fetchAdminData = useCallback(async () => {
    try {
      setLoadingData(true);
      setAccessDenied(false);

      const summaryRes = await fetch('/api/admin/summary');
      if (summaryRes.status === 403) {
        setAccessDenied(true);
        setLoadingData(false);
        return;
      }

      if (summaryRes.ok) {
        const sumData = await summaryRes.json();
        setSummary(sumData);
      }

      // Fetch tab-specific data
      if (activeTab === 'users') {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(searchQuery)}&status=${statusFilter}`);
        if (res.ok) {
          const data = await res.json();
          setUsersList(data.users || []);
        }
      } else if (activeTab === 'nodes') {
        const res = await fetch(`/api/admin/nodes?search=${encodeURIComponent(searchQuery)}&status=${statusFilter}`);
        if (res.ok) {
          const data = await res.json();
          setNodesList(data.nodes || []);
        }
      } else if (activeTab === 'orders') {
        const res = await fetch(`/api/admin/orders?search=${encodeURIComponent(searchQuery)}&status=${statusFilter}`);
        if (res.ok) {
          const data = await res.json();
          setOrdersList(data.orders || []);
        }
      } else if (activeTab === 'withdrawals') {
        const res = await fetch(`/api/admin/withdrawals?search=${encodeURIComponent(searchQuery)}&status=${statusFilter}`);
        if (res.ok) {
          const data = await res.json();
          setWithdrawalsList(data.withdrawals || []);
        }
      } else if (activeTab === 'transactions') {
        const res = await fetch(`/api/admin/transactions?search=${encodeURIComponent(searchQuery)}&type=${statusFilter}`);
        if (res.ok) {
          const data = await res.json();
          setTransactionsList(data.transactions || []);
        }
      } else if (activeTab === 'audit') {
        const res = await fetch(`/api/admin/audit-logs`);
        if (res.ok) {
          const data = await res.json();
          setAuditList(data.logs || []);
        }
      }
    } catch (err) {
      console.error('[AdminPage] Fetch error:', err);
    } finally {
      setLoadingData(false);
    }
  }, [activeTab, searchQuery, statusFilter]);

  useEffect(() => {
    if (!loading && user) {
      fetchAdminData();
    }
  }, [loading, user, fetchAdminData]);

  // Handle Tab Switch
  const handleSelectTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setStatusFilter('ALL');
    onNavigate(tab === 'overview' ? '/admin' : `/admin/${tab}`);
  };

  // 1. Auth Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#05070B] text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="p-8 rounded-2xl bg-[#07101D] border border-white/[0.08] flex flex-col items-center space-y-4 max-w-sm w-full text-center">
          <PhivonexLogo size="lg" />
          <div className="flex items-center gap-2 text-xs text-[#00CFFF] font-mono">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying Admin Credentials...</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Access Denied State (403 Forbidden)
  if (accessDenied || (user && (user as any).role !== 'ADMIN')) {
    return (
      <div className="min-h-screen bg-[#05070B] text-white flex flex-col items-center justify-center p-4 font-sans selection:bg-[#F04438]/20">
        <div className="p-8 rounded-2xl bg-[#07101D] border border-[#F04438]/30 shadow-2xl flex flex-col items-center text-center space-y-4 max-w-md w-full">
          <div className="w-12 h-12 rounded-xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-center justify-center text-[#F04438]">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white">403 — Administrative Access Denied</h1>
          <p className="text-xs text-[#98A2B3]">
            Your operator account ({(user as any)?.publicId || 'Operator'}) does not possess administrative RBAC authorization for the PHIVONEX protocol control plane.
          </p>
          <button
            onClick={() => onNavigate('/app')}
            className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            Return to User Dashboard
          </button>
        </div>
      </div>
    );
  }

  const NAV_ITEMS = [
    { id: 'overview' as AdminTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'users' as AdminTab, label: 'Users', icon: Users },
    { id: 'nodes' as AdminTab, label: 'Nodes Inventory', icon: Server },
    { id: 'orders' as AdminTab, label: 'Node Orders', icon: ShoppingBag },
    { id: 'withdrawals' as AdminTab, label: 'Withdrawals & Payouts', icon: ArrowUpRight, badge: summary?.pendingWithdrawalsCount },
    { id: 'transactions' as AdminTab, label: 'Ledger Explorer', icon: ArrowLeftRight },
    { id: 'network' as AdminTab, label: 'Network Telemetry', icon: GitFork },
    { id: 'audit' as AdminTab, label: 'Admin Audit Logs', icon: FileText },
  ];

  return (
    <div className="min-h-screen bg-[#05070B] text-[#F7FAFC] flex font-sans selection:bg-[#00CFFF]/20">
      {/* Sidebar */}
      <aside className="w-64 fixed inset-y-0 left-0 bg-[#07101D] border-r border-white/[0.08] flex flex-col justify-between p-4 z-30 select-none hidden lg:flex">
        <div className="space-y-6">
          <div className="flex items-center gap-2 px-2">
            <PhivonexLogo size="md" />
            <span className="text-[10px] font-mono px-2 py-0.5 bg-[#F04438]/10 text-[#F04438] border border-[#F04438]/30 rounded font-bold uppercase">
              Admin
            </span>
          </div>

          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-[#98A2B3]">
              Control Plane Navigation
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-[#00CFFF]/15 to-[#168BFF]/10 text-white border border-[#00CFFF]/30'
                      : 'text-[#98A2B3] hover:text-white hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[#00CFFF]' : 'text-[#98A2B3]'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#FFB020] text-[#05070B] text-[10px] font-mono font-bold">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] font-mono space-y-1 text-[#98A2B3]">
          <div className="text-white font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#32D583]" />
            RBAC Authenticated
          </div>
          <div>Admin: {(user as any)?.publicId || 'ADMIN'}</div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-white/[0.08] bg-[#07101D]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-white capitalize flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#00CFFF]" />
              PHIVONEX Protocol Admin Panel — {activeTab}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAdminData}
              disabled={loadingData}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.1] text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#00CFFF] ${loadingData ? 'animate-spin' : ''}`} />
              <span>Sync System Data</span>
            </button>
            <button
              onClick={() => onNavigate('/app')}
              className="px-3 py-1.5 rounded-lg bg-[#00CFFF]/10 hover:bg-[#00CFFF]/20 text-[#00CFFF] border border-[#00CFFF]/30 text-xs font-bold transition-colors cursor-pointer"
            >
              User App
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="p-6 max-w-7xl w-full mx-auto space-y-8">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#07101D] border border-white/[0.08] space-y-1">
                  <div className="text-xs text-[#98A2B3] flex items-center justify-between">
                    <span>Total Registered Users</span>
                    <Users className="w-4 h-4 text-[#00CFFF]" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">{summary?.totalUsers || 0}</div>
                  <div className="text-[11px] text-[#32D583]">{summary?.activeUsers || 0} Active Users</div>
                </div>

                <div className="p-4 rounded-xl bg-[#07101D] border border-white/[0.08] space-y-1">
                  <div className="text-xs text-[#98A2B3] flex items-center justify-between">
                    <span>Genesis Node Supply</span>
                    <Server className="w-4 h-4 text-[#00CFFF]" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">{summary?.activeNodes || 0} / 10,000</div>
                  <div className="text-[11px] text-[#98A2B3]">{summary?.availableNodes || 0} Available</div>
                </div>

                <div className="p-4 rounded-xl bg-[#07101D] border border-white/[0.08] space-y-1">
                  <div className="text-xs text-[#98A2B3] flex items-center justify-between">
                    <span>Pending Withdrawals</span>
                    <ArrowUpRight className="w-4 h-4 text-[#FFB020]" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">${(summary?.pendingWithdrawalsAmount || 0).toFixed(2)}</div>
                  <div className="text-[11px] text-[#FFB020]">{summary?.pendingWithdrawalsCount || 0} Requests Awaiting Review</div>
                </div>

                <div className="p-4 rounded-xl bg-[#07101D] border border-white/[0.08] space-y-1">
                  <div className="text-xs text-[#98A2B3] flex items-center justify-between">
                    <span>Total Disbursed Payouts</span>
                    <CheckCircle2 className="w-4 h-4 text-[#32D583]" />
                  </div>
                  <div className="text-2xl font-extrabold text-white font-mono">${(summary?.completedWithdrawalsTotal || 0).toFixed(2)}</div>
                  <div className="text-[11px] text-[#32D583]">Settled Lifetime</div>
                </div>
              </div>

              {/* Economic Totals Breakdown */}
              <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[#00CFFF]" />
                  System-Wide Economic Totals
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                    <span className="text-[#98A2B3] text-[10px] uppercase">Referral Commissions</span>
                    <div className="text-lg font-bold text-white">${(summary?.referralCommissionsTotal || 0).toFixed(2)}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                    <span className="text-[#98A2B3] text-[10px] uppercase">Binary Matching Bonuses</span>
                    <div className="text-lg font-bold text-white">${(summary?.matchingSettlementsTotal || 0).toFixed(2)}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                    <span className="text-[#98A2B3] text-[10px] uppercase">Promotion Milestone Bonuses</span>
                    <div className="text-lg font-bold text-white">${(summary?.promotionBonusesTotal || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USERS */}
          {activeTab === 'users' && (
            <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
                <h2 className="text-sm font-bold text-white">System User Accounts</h2>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Search name, email, public ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-3 py-1.5 bg-[#05070B] border border-white/[0.1] rounded-lg text-xs text-white outline-none w-64"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-1.5 bg-[#05070B] border border-white/[0.1] rounded-lg text-xs text-white outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="LOCKED">Locked</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[#98A2B3] border-b border-white/[0.06] uppercase text-[10px] font-mono">
                      <th className="py-2.5 px-3">Public ID</th>
                      <th className="py-2.5 px-3">Full Name</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Sponsor</th>
                      <th className="py-2.5 px-3">Active Nodes</th>
                      <th className="py-2.5 px-3">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3 font-mono font-bold text-white">{u.publicId}</td>
                        <td className="py-3 px-3 text-white font-medium">{u.fullName}</td>
                        <td className="py-3 px-3 text-[#98A2B3]">{u.email}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${u.status === 'ACTIVE' ? 'bg-[#32D583]/10 text-[#32D583]' : 'bg-[#F04438]/10 text-[#F04438]'}`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#00CFFF]">{u.role}</td>
                        <td className="py-3 px-3 font-mono text-[#98A2B3]">{u.sponsorPublicId || 'None'}</td>
                        <td className="py-3 px-3 font-mono font-bold text-white">{u.nodeCount}</td>
                        <td className="py-3 px-3 text-[#98A2B3]">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: WITHDRAWALS (STATE MANAGEMENT & SETTLEMENT CONTROL) */}
          {activeTab === 'withdrawals' && (
            <WithdrawalManagement
              summaryMetrics={summary}
              onRefreshSummary={fetchAdminData}
            />
          )}

          {/* TAB 4: TRANSACTIONS (LEDGER EXPLORER) */}
          {activeTab === 'transactions' && (
            <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] space-y-4">
              <h2 className="text-sm font-bold text-white">System Financial Ledger Explorer</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[#98A2B3] border-b border-white/[0.06] uppercase text-[10px] font-mono">
                      <th className="py-2.5 px-3">Txn ID</th>
                      <th className="py-2.5 px-3">User</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Source</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {transactionsList.map((t) => (
                      <tr key={t.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3 font-mono font-bold text-white">{t.publicTxnId}</td>
                        <td className="py-3 px-3 font-mono text-[#00CFFF]">{t.userPublicId}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          <span className={`px-2 py-0.5 rounded ${t.entryType === 'CREDIT' ? 'bg-[#32D583]/10 text-[#32D583]' : 'bg-[#F04438]/10 text-[#F04438]'}`}>
                            {t.entryType}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[#98A2B3]">{t.sourceType}</td>
                        <td className="py-3 px-3 font-mono font-bold text-white">${t.amount.toFixed(2)}</td>
                        <td className="py-3 px-3 text-[#98A2B3]">{t.description}</td>
                        <td className="py-3 px-3 text-[#98A2B3] font-mono">{new Date(t.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT LOGS */}
          {activeTab === 'audit' && (
            <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] space-y-4">
              <h2 className="text-sm font-bold text-white">Administrative Financial Action Audit Trail</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[#98A2B3] border-b border-white/[0.06] uppercase text-[10px] font-mono">
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3">Admin</th>
                      <th className="py-2.5 px-3">Target ID</th>
                      <th className="py-2.5 px-3">Audit Details</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {auditList.map((a) => (
                      <tr key={a.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3 font-mono font-bold text-[#00CFFF]">{a.action}</td>
                        <td className="py-3 px-3 font-mono text-white">{a.adminPublicId}</td>
                        <td className="py-3 px-3 font-mono text-[#98A2B3]">{a.targetId}</td>
                        <td className="py-3 px-3 text-white">{a.details}</td>
                        <td className="py-3 px-3 text-[#98A2B3] font-mono">{new Date(a.createdAt).toUTCString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
