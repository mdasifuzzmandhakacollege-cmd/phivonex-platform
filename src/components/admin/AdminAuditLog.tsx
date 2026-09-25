import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Activity,
  Search,
  Filter,
  RefreshCw,
  Download,
  Server,
  DollarSign,
  User,
  Clock,
  CheckCircle2,
  FileText,
  AlertCircle,
  Layers,
  ChevronRight,
  Eye,
  Sliders,
  Database,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Lock,
  Sparkles,
  Info,
  X
} from 'lucide-react';

export type AuditCategory = 'ALL' | 'NODE_ACTIVATION' | 'FINANCIAL' | 'ADMIN_ACTION' | 'SECURITY';

export interface AuditEventItem {
  id: string;
  category: 'NODE_ACTIVATION' | 'FINANCIAL' | 'ADMIN_ACTION' | 'SECURITY';
  action: string;
  actorPublicId: string;
  targetType: string;
  targetId: string;
  amountUsd?: number | null;
  currency?: string | null;
  details: string;
  metadata?: Record<string, any> | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface AuditSummaryStats {
  totalEvents: number;
  nodeActivationsCount: number;
  financialTransactionsCount: number;
  adminActionsCount: number;
  securityEventsCount: number;
  lastReconciliationAt: string | null;
}

export const AdminAuditLog: React.FC = () => {
  const [category, setCategory] = useState<AuditCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [events, setEvents] = useState<AuditEventItem[]>([]);
  const [stats, setStats] = useState<AuditSummaryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [selectedEvent, setSelectedEvent] = useState<AuditEventItem | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  // Fetch Unified Audit Trail
  const fetchAuditData = useCallback(async () => {
    try {
      setRefreshing(true);
      const categoryParam = category !== 'ALL' ? `&category=${category}` : '';
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      
      const res = await fetch(`/api/admin/audit-logs/feed?limit=50${categoryParam}${searchParam}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setStats(data.stats || null);
      } else {
        // Fallback to legacy endpoint if feed endpoint not present
        const legacyRes = await fetch(`/api/admin/audit-logs?limit=50`);
        if (legacyRes.ok) {
          const legData = await legacyRes.json();
          const mappedEvents: AuditEventItem[] = (legData.logs || []).map((log: any) => ({
            id: log.id,
            category: log.action.includes('NODE') ? 'NODE_ACTIVATION' : log.action.includes('WITHDRAWAL') || log.action.includes('SWAP') || log.action.includes('DEPOSIT') ? 'FINANCIAL' : 'ADMIN_ACTION',
            action: log.action,
            actorPublicId: log.adminPublicId || 'SYSTEM_ADMIN',
            targetType: log.targetType || 'SYSTEM',
            targetId: log.targetId || 'N/A',
            details: log.details,
            metadata: log.metadata,
            ipAddress: log.ipAddress,
            createdAt: log.createdAt,
          }));
          setEvents(mappedEvents);
        }
      }
    } catch (err) {
      console.error('[AdminAuditLog] Error fetching audit trail:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, searchQuery]);

  useEffect(() => {
    fetchAuditData();
  }, [fetchAuditData]);

  // Auto Refresh Interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAuditData();
    }, 10000); // 10 seconds live poll
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAuditData]);

  // Export CSV Report
  const handleExportCsv = () => {
    try {
      setExporting(true);
      const headers = ['Event ID', 'Timestamp', 'Category', 'Action', 'Actor Public ID', 'Target Type', 'Target ID', 'Details', 'IP Address'];
      const rows = events.map(e => [
        e.id,
        new Date(e.createdAt).toISOString(),
        e.category,
        e.action,
        e.actorPublicId,
        e.targetType,
        e.targetId,
        `"${e.details.replace(/"/g, '""')}"`,
        e.ipAddress || 'Internal'
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `phivonex_compliance_audit_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('[AdminAuditLog] CSV export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const getCategoryBadge = (cat: AuditEventItem['category']) => {
    switch (cat) {
      case 'NODE_ACTIVATION':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00CFFF]/10 text-[#00CFFF] border border-[#00CFFF]/30 flex items-center gap-1">
            <Server className="w-3 h-3" /> NODE ACTIVATION
          </span>
        );
      case 'FINANCIAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#32D583]/10 text-[#32D583] border border-[#32D583]/30 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> FINANCIAL
          </span>
        );
      case 'ADMIN_ACTION':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Sliders className="w-3 h-3" /> ADMIN CONTROL
          </span>
        );
      case 'SECURITY':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> SECURITY
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
            SYSTEM
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-b from-[#0A192F] to-[#07101D] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-xl bg-[#00CFFF]/10 border border-[#00CFFF]/30 text-[#00CFFF]">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#32D583]/10 border border-[#32D583]/30 text-[#32D583]">
              COMPLIANCE &amp; RECONCILIATION AUDIT
            </span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Real-Time System Audit Trail
          </h1>
          <p className="text-xs text-[#98A2B3] mt-1 max-w-xl">
            Authoritative, immutable event stream tracking node activations, financial ledger movements, administrative economic parameter overrides, and security sessions.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl border text-xs font-mono font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-white/[0.04] border-white/[0.08] text-[#98A2B3]'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
            <span>{autoRefresh ? 'Live Stream Active' : 'Live Stream Paused'}</span>
          </button>

          <button
            onClick={fetchAuditData}
            disabled={refreshing}
            className="px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={exporting || events.length === 0}
            className="px-4 py-2 rounded-xl bg-[#00CFFF]/15 hover:bg-[#00CFFF]/25 border border-[#00CFFF]/40 text-[#00CFFF] text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Audit CSV</span>
          </button>
        </div>
      </div>

      {/* Real-time Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#07101D] border border-white/[0.08] space-y-1">
          <div className="flex items-center justify-between text-[#98A2B3] text-[11px] font-mono">
            <span>TOTAL AUDIT EVENTS</span>
            <Database className="w-4 h-4 text-[#00CFFF]" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {stats?.totalEvents || events.length}
          </div>
          <p className="text-[10px] text-[#98A2B3]">Verified in audit ledger</p>
        </div>

        <div className="p-4 rounded-xl bg-[#07101D] border border-white/[0.08] space-y-1">
          <div className="flex items-center justify-between text-[#98A2B3] text-[11px] font-mono">
            <span>NODE ACTIVATIONS</span>
            <Server className="w-4 h-4 text-[#00CFFF]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#00CFFF]">
            {stats?.nodeActivationsCount || events.filter(e => e.category === 'NODE_ACTIVATION').length}
          </div>
          <p className="text-[10px] text-[#98A2B3]">Genesis Node purchases &amp; states</p>
        </div>

        <div className="p-4 rounded-xl bg-[#07101D] border border-white/[0.08] space-y-1">
          <div className="flex items-center justify-between text-[#98A2B3] text-[11px] font-mono">
            <span>FINANCIAL MOVEMENTS</span>
            <DollarSign className="w-4 h-4 text-[#32D583]" />
          </div>
          <div className="text-xl font-bold font-mono text-[#32D583]">
            {stats?.financialTransactionsCount || events.filter(e => e.category === 'FINANCIAL').length}
          </div>
          <p className="text-[10px] text-[#98A2B3]">Swaps, withdrawals &amp; deposits</p>
        </div>

        <div className="p-4 rounded-xl bg-[#07101D] border border-white/[0.08] space-y-1">
          <div className="flex items-center justify-between text-[#98A2B3] text-[11px] font-mono">
            <span>ADMIN &amp; SECURITY</span>
            <Sliders className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-300">
            {(stats?.adminActionsCount || 0) + (stats?.securityEventsCount || 0)}
          </div>
          <p className="text-[10px] text-[#98A2B3]">Economic controls &amp; auth</p>
        </div>
      </div>

      {/* Category Tabs & Filter Toolbar */}
      <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/[0.08] overflow-x-auto">
            <button
              onClick={() => setCategory('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                category === 'ALL'
                  ? 'bg-[#00CFFF] text-slate-950 font-bold shadow-md shadow-[#00CFFF]/20'
                  : 'text-[#98A2B3] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setCategory('NODE_ACTIVATION')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                category === 'NODE_ACTIVATION'
                  ? 'bg-[#00CFFF] text-slate-950 font-bold shadow-md shadow-[#00CFFF]/20'
                  : 'text-[#98A2B3] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Node Activations
            </button>
            <button
              onClick={() => setCategory('FINANCIAL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                category === 'FINANCIAL'
                  ? 'bg-[#32D583] text-slate-950 font-bold shadow-md shadow-[#32D583]/20'
                  : 'text-[#98A2B3] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Financial Ledger
            </button>
            <button
              onClick={() => setCategory('ADMIN_ACTION')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                category === 'ADMIN_ACTION'
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/20'
                  : 'text-[#98A2B3] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Admin Actions
            </button>
            <button
              onClick={() => setCategory('SECURITY')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                category === 'SECURITY'
                  ? 'bg-purple-400 text-slate-950 font-bold shadow-md shadow-purple-400/20'
                  : 'text-[#98A2B3] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              Security Log
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#98A2B3] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Actor ID, Action, Target, or Details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/[0.1] text-xs text-white placeholder-[#98A2B3] focus:outline-none focus:border-[#00CFFF] w-full md:w-72"
            />
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] text-[#98A2B3] uppercase font-mono tracking-wider text-[10px]">
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Actor Public ID</th>
                <th className="py-3 px-3">Target Ref</th>
                <th className="py-3 px-3">Details</th>
                <th className="py-3 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#98A2B3]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#00CFFF]" />
                    <p className="font-semibold text-white">Loading live compliance audit trail...</p>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#98A2B3]">
                    <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-semibold text-white">No audit records match the selected filter</p>
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-3 font-mono text-[#98A2B3] text-[11px] whitespace-nowrap">
                      {new Date(evt.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-3">
                      {getCategoryBadge(evt.category)}
                    </td>
                    <td className="py-3.5 px-3 font-mono font-bold text-white">
                      {evt.action}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[#00CFFF] font-medium">
                      {evt.actorPublicId}
                    </td>
                    <td className="py-3.5 px-3 font-mono text-[#98A2B3]">
                      <span className="px-1.5 py-0.5 rounded bg-black/40 border border-white/[0.06] text-[10px]">
                        {evt.targetType}: {evt.targetId}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-slate-300 max-w-xs truncate">
                      {evt.details}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedEvent(evt)}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-[#00CFFF] hover:text-white font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AUDIT METADATA INSPECTOR MODAL */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#0B1528] border border-[#00CFFF]/40 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#00CFFF]" />
                <h3 className="text-base font-bold text-white">Audit Event Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-[#98A2B3] hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-[#98A2B3]">Event ID</span>
                <span className="font-mono text-cyan-300 select-all">{selectedEvent.id}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-[#98A2B3]">Timestamp</span>
                <span className="font-mono text-white">{new Date(selectedEvent.createdAt).toUTCString()}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-[#98A2B3]">Action Name</span>
                <span className="font-mono font-bold text-white">{selectedEvent.action}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-[#98A2B3]">Actor Public ID</span>
                <span className="font-mono text-[#00CFFF]">{selectedEvent.actorPublicId}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-[#98A2B3]">Target Reference</span>
                <span className="font-mono text-amber-300">{selectedEvent.targetType}: {selectedEvent.targetId}</span>
              </div>

              <div className="flex justify-between items-center py-1 border-b border-white/[0.04]">
                <span className="text-[#98A2B3]">IP Address</span>
                <span className="font-mono text-slate-300">{selectedEvent.ipAddress || 'Internal Protocol / System'}</span>
              </div>

              <div className="space-y-1 pt-2">
                <span className="text-[#98A2B3] block font-semibold">Audit Narrative / Description</span>
                <p className="p-3 rounded-xl bg-black/40 border border-white/[0.08] text-slate-200 leading-relaxed">
                  {selectedEvent.details}
                </p>
              </div>

              {selectedEvent.metadata && (
                <div className="space-y-1 pt-2">
                  <span className="text-[#98A2B3] block font-semibold">Structured Audit Metadata (JSON)</span>
                  <pre className="p-3 rounded-xl bg-black/60 border border-white/[0.08] font-mono text-[11px] text-cyan-200 overflow-x-auto max-h-48">
                    {JSON.stringify(selectedEvent.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full py-2.5 rounded-xl bg-[#00CFFF] text-xs font-bold text-slate-950 hover:brightness-110"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
