import React from 'react';
import {
  Server,
  Activity,
  Layers,
  Coins,
  ShieldCheck,
  Radio,
  Clock,
  RefreshCw,
  Zap,
  CheckCircle2,
  Lock,
  ArrowRight
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { usePublicNetwork } from '../hooks/usePublicNetwork';
import { PhivonexLogo } from '../components/brand/PhivonexLogo';

interface NetworkPublicPageProps {
  onNavigate: (route: string) => void;
}

export const NetworkPublicPage: React.FC<NetworkPublicPageProps> = ({ onNavigate }) => {
  const { summary, events, isConnected, loading, refetch } = usePublicNetwork();

  // Helper for relative timestamps
  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const elapsedMs = Date.now() - new Date(isoString).getTime();
      const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
      if (elapsedSec < 30) return 'Just now';
      if (elapsedSec < 60) return `${elapsedSec}s ago`;
      const elapsedMin = Math.floor(elapsedSec / 60);
      if (elapsedMin < 60) return `${elapsedMin}m ago`;
      const elapsedHour = Math.floor(elapsedMin / 60);
      if (elapsedHour < 24) return `${elapsedHour}h ago`;
      const elapsedDays = Math.floor(elapsedHour / 24);
      return `${elapsedDays}d ago`;
    } catch {
      return 'Recent';
    }
  };

  return (
    <div className="min-h-screen bg-[#05070B] text-[#F7FAFC] font-sans selection:bg-[#00CFFF]/20 selection:text-[#00CFFF]">
      {/* Public Navigation */}
      <Navbar
        onExploreClick={() => onNavigate('/')}
        onLaunchAppClick={() => onNavigate('/login')}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#07101D] via-[#0B182D] to-[#07101D] border border-[#00CFFF]/30 p-8 sm:p-10 shadow-2xl space-y-6">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-80 h-80 bg-[#00CFFF]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00CFFF]/10 border border-[#00CFFF]/30 text-xs font-mono text-[#00CFFF]">
                <Radio className={`w-3.5 h-3.5 ${isConnected ? 'animate-pulse text-[#32D583]' : 'text-[#00CFFF]'}`} />
                <span>PUBLIC NETWORK EXPLORER &amp; LIVE TELEMETRY</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                PHIVONEX Public Ledger
              </h1>
              <p className="text-sm text-[#98A2B3] leading-relaxed">
                Cryptographically verifiable, real-time public telemetry for the 10,000 Genesis Node network. All statistics reflect authoritative backend ledger state. Zero private user credentials exposed.
              </p>
            </div>

            <div className="flex flex-col items-stretch sm:items-end gap-3 shrink-0">
              <div className="px-4 py-3 rounded-2xl bg-[#05070B] border border-white/[0.08] flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-[#32D583] shadow-lg shadow-[#32D583]/50 animate-pulse' : 'bg-[#F79009]'}`} />
                <div>
                  <div className="text-[10px] font-mono text-[#98A2B3] uppercase">Stream Status</div>
                  <div className="text-xs font-mono font-bold text-white">
                    {isConnected ? 'LIVE STREAM ACTIVE' : 'REST POLLING (FALLBACK)'}
                  </div>
                </div>
              </div>

              <button
                onClick={refetch}
                className="px-4 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-mono text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#00CFFF]' : ''}`} />
                <span>Refresh Snapshot</span>
              </button>
            </div>
          </div>
        </div>

        {/* 6 Key Network Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1: Active Nodes */}
          <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#00CFFF]/40 transition-all shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">Active Genesis Nodes</span>
              <Server className="w-4 h-4 text-[#00CFFF]" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-[#00CFFF] tracking-tight">
              {summary.activeNodes.toLocaleString()}
            </div>
            <p className="text-xs text-[#98A2B3] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#32D583]" />
              <span>{summary.reservedNodes} pending reservations</span>
            </p>
          </div>

          {/* Card 2: Remaining Available Nodes */}
          <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#32D583]/40 transition-all shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">Available Nodes</span>
              <Coins className="w-4 h-4 text-[#32D583]" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-[#32D583] tracking-tight">
              {summary.availableNodes.toLocaleString()}
            </div>
            <p className="text-xs text-[#98A2B3]">
              Out of {summary.genesisNodeCap.toLocaleString()} hardcoded Genesis limit
            </p>
          </div>

          {/* Card 3: Allocation % */}
          <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#7F56D9]/40 transition-all shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">Node Allocation Progress</span>
              <Activity className="w-4 h-4 text-[#7F56D9]" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white tracking-tight">
              {summary.allocationPercent}%
            </div>
            <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#00CFFF] to-[#32D583] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, summary.allocationPercent))}%` }}
              />
            </div>
          </div>

          {/* Card 4: Current Reward Epoch */}
          <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#F79009]/40 transition-all shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">Current Mining Epoch</span>
              <Zap className="w-4 h-4 text-[#F79009]" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-[#F79009] tracking-tight">
              Epoch #{summary.currentRewardEpoch}
            </div>
            <p className="text-xs text-[#98A2B3]">
              Daily validator epoch reward accruals
            </p>
          </div>

          {/* Card 5: Total Network Transactions */}
          <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#00CFFF]/40 transition-all shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">Total Ledger Transactions</span>
              <Layers className="w-4 h-4 text-[#00CFFF]" />
            </div>
            <div className="text-3xl font-mono font-extrabold text-white tracking-tight">
              {summary.totalNetworkTransactions.toLocaleString()}
            </div>
            <p className="text-xs text-[#98A2B3]">
              Audited entries in protocol database
            </p>
          </div>

          {/* Card 6: Network Status */}
          <div className="p-6 rounded-2xl bg-[#07101D] border border-white/[0.08] hover:border-[#32D583]/40 transition-all shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs text-[#98A2B3]">
              <span className="font-mono uppercase text-[11px] tracking-wider">Network Health</span>
              <ShieldCheck className="w-4 h-4 text-[#32D583]" />
            </div>
            <div className="text-2xl font-mono font-extrabold text-[#32D583] flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#32D583] animate-pulse" />
              <span>{summary.networkStatus}</span>
            </div>
            <p className="text-xs text-[#98A2B3]">
              All protocol consensus systems synchronized
            </p>
          </div>
        </div>

        {/* Node Supply Progress & Fixed Limits Section */}
        <div className="p-8 rounded-3xl bg-[#07101D] border border-white/[0.08] shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#00CFFF]" />
                <span>Genesis Node Network Allocation</span>
              </h2>
              <p className="text-xs text-[#98A2B3] mt-0.5">
                Fixed 10,000 Genesis Node cap mathematically hardcoded into the PHIVONEX protocol.
              </p>
            </div>
            <div className="text-xs font-mono text-[#00CFFF] bg-[#00CFFF]/10 px-3 py-1.5 rounded-full border border-[#00CFFF]/20 self-start sm:self-auto">
              Hard Cap: 10,000 Nodes
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-white font-bold">
                {summary.activeNodes + summary.reservedNodes} / {summary.genesisNodeCap} Nodes Allocated
              </span>
              <span className="text-[#32D583] font-bold">
                {summary.availableNodes} Nodes Available for Acquisition
              </span>
            </div>

            <div className="w-full bg-[#05070B] h-4 rounded-full p-0.5 border border-white/[0.08] overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#00CFFF] via-[#32D583] to-[#7F56D9] h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, Math.max(0, summary.allocationPercent))}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <span className="text-[10px] text-[#98A2B3] uppercase font-mono">Maximum Cap</span>
                <span className="text-sm font-bold text-white block">10,000 Nodes</span>
              </div>
              <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <span className="text-[10px] text-[#98A2B3] uppercase font-mono">Active Nodes</span>
                <span className="text-sm font-bold text-[#00CFFF] block">{summary.activeNodes}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <span className="text-[10px] text-[#98A2B3] uppercase font-mono">Reserved</span>
                <span className="text-sm font-bold text-[#F79009] block">{summary.reservedNodes}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <span className="text-[10px] text-[#98A2B3] uppercase font-mono">Available</span>
                <span className="text-sm font-bold text-[#32D583] block">{summary.availableNodes}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Network Events Stream Section */}
        <div className="p-8 rounded-3xl bg-[#07101D] border border-white/[0.08] shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#00CFFF]" />
                <span>Live Network Activity Stream</span>
              </h2>
              <p className="text-xs text-[#98A2B3] mt-0.5">
                Real-time, privacy-safe event feed streamed directly from protocol ledger entries.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-[#98A2B3] bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.06] self-start sm:self-auto">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#32D583] animate-pulse' : 'bg-[#F79009]'}`} />
              <span>{events.length} Real-Time Events Logged</span>
            </div>
          </div>

          {events.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#98A2B3] font-mono border border-dashed border-white/[0.08] rounded-2xl space-y-2">
              <div className="text-white font-medium">Listening for live protocol network events...</div>
              <p>Events will stream automatically as node activations or epoch settlements post.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-4 rounded-2xl bg-[#05070B] border border-white/[0.06] hover:border-[#00CFFF]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF] shrink-0 mt-0.5 sm:mt-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{evt.title}</span>
                        {evt.publicId && (
                          <span className="font-mono text-[10px] text-[#00CFFF] px-2 py-0.5 rounded bg-[#00CFFF]/10 border border-[#00CFFF]/20">
                            {evt.publicId}
                          </span>
                        )}
                      </div>
                      <p className="text-[#98A2B3]">{evt.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-[#98A2B3] shrink-0 self-end sm:self-auto">
                    <Clock className="w-3.5 h-3.5 text-[#00CFFF]" />
                    <span>{formatRelativeTime(evt.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Privacy & Zero-Knowledge Guarantee Banner */}
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/[0.08] flex items-start gap-4 text-xs text-[#98A2B3]">
          <Lock className="w-5 h-5 text-[#00CFFF] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-bold text-white text-sm">
              Strict Public Privacy Policy Enforced
            </h3>
            <p className="leading-relaxed">
              All public telemetry payloads are filtered and sanitized server-side before dispatch. Public telemetry endpoints and realtime SSE streams strictly omit full names, emails, phone numbers, IP addresses, internal database UUIDs, private wallet balances, and individual user earnings.
            </p>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="p-8 rounded-3xl bg-gradient-to-r from-[#00CFFF]/10 via-[#07101D] to-[#32D583]/10 border border-[#00CFFF]/30 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="text-lg font-bold text-white">
              Ready to participate in the PHIVONEX Genesis Node network?
            </h3>
            <p className="text-xs text-[#98A2B3]">
              Acquire a Genesis Node or launch your operator command dashboard.
            </p>
          </div>

          <button
            onClick={() => onNavigate('/register')}
            className="px-6 py-3 rounded-2xl bg-[#00CFFF] hover:bg-[#00CFFF]/90 text-[#05070B] font-extrabold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-[#00CFFF]/20 shrink-0 min-h-[44px]"
          >
            <span>Launch Operator Console</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </main>

      <Footer
        onOpenLegal={() => {}}
        onExploreClick={() => onNavigate('/')}
      />
    </div>
  );
};
