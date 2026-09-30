import React, { useState } from 'react';
import {
  Server,
  Activity,
  Layers,
  Coins,
  Shield,
  ArrowRight,
  ArrowUpRight,
  Users,
  Lock,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  RefreshCw,
  Globe,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Zap,
  Cpu,
  BarChart3
} from 'lucide-react';
import { usePublicNetwork } from '../hooks/usePublicNetwork';
import { PhivonexSymbol } from '../components/brand/PhivonexSymbol';
import { PHIVONEX_TOKEN_CONFIG } from '../server/config/tokenConfig';

interface PublicLandingPageProps {
  onNavigate: (route: string) => void;
  user: any;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ onNavigate, user }) => {
  const { summary, events, isConnected } = usePublicNetwork();

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Mobile Menu State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Contract Copy State
  const [contractCopied, setContractCopied] = useState(false);

  const copyContractAddress = () => {
    navigator.clipboard.writeText(PHIVONEX_TOKEN_CONFIG.contractAddress);
    setContractCopied(true);
    setTimeout(() => setContractCopied(false), 2000);
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

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
      return 'Today';
    } catch {
      return 'Recent';
    }
  };

  // Dynamic Metrics Fallback
  const stats = {
    maxSupply: '100,000,000 PHIVO',
    nodeCap: summary.genesisNodeCap || 10000,
    activeNodes: summary.activeNodes,
    networkTransactions: summary.totalNetworkTransactions || 0,
    conversionRate: typeof summary.conversionRateUsd === 'number' && summary.conversionRateUsd > 0 ? summary.conversionRateUsd : null,
    epoch: summary.currentRewardEpoch || 1,
    allocatedPercent: summary.allocationPercent || 0,
    availableNodes: summary.availableNodes || 0
  };

  const faqItems = [
    {
      q: 'What is PHIVONEX?',
      a: 'PHIVONEX is an enterprise-grade decentralized infrastructure network powering the next wave of Web3 applications. By utilizing a hard-capped supply of 10,000 Genesis Nodes, we establish a robust, high-performance ecosystem for securing and validating digital assets.'
    },
    {
      q: 'What is a Genesis Node?',
      a: 'A Genesis Node is a key infrastructure validator within the PHIVONEX network. There is a fixed maximum of 10,000 Genesis Nodes globally. Activating a node allows operators to directly participate in network validation, earning PHIVO rewards per epoch.'
    },
    {
      q: 'What is PHIVO?',
      a: 'PHIVO is the native ecosystem asset of PHIVONEX, issued primarily as node validation rewards. Referral, matching, and promotional incentives are governed by distinct configured server-side financial ledger rules.'
    },
    {
      q: 'How does PHIVO → USDT work?',
      a: 'PHIVONEX features an integrated internal swap module that allows users to convert accumulated PHIVO rewards into USDT instantly within their secure wallet ledger based on the active administrative conversion rate. Historical swaps retain the rate recorded at execution.'
    },
    {
      q: 'How are rewards calculated?',
      a: 'Node rewards are distributed per epoch based on real-time node activity, qualifying network participation, and configured protocol rules.'
    },
    {
      q: 'Is PHIVONEX transparent?',
      a: 'Yes. PHIVONEX provides a public ledger where node activations, reward epochs, and swap events are systematically logged and publicly verifiable in our network telemetry feed.'
    },
    {
      q: 'How is user security handled?',
      a: 'We implement rigorous, enterprise-grade security. All critical operations—including funds ledgering, withdrawals, and swap settlements—are validated server-side. Sensitive API keys and internal secrets are stored exclusively on secure servers and never exposed to client browsers.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#05070B] text-[#F5F7FA] font-sans antialiased selection:bg-[#00CFFF]/20 selection:text-[#00CFFF] overflow-x-hidden">
      
      {/* ----------------------------------------------------------------------
          1. HEADER / NAVIGATION (Sticky Glassmorphic Header)
         ---------------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#05070C]/85 border-b border-white/[0.08] transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          
          {/* Brand Wordmark */}
          <div 
            className="flex items-center gap-2.5 cursor-pointer select-none group" 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <PhivonexSymbol size={32} animated={true} glow={true} />
            <span className="text-xl sm:text-2xl font-extrabold tracking-wider bg-gradient-to-r from-white via-[#E0F2FE] to-[#00CFFF] bg-clip-text text-transparent font-mono group-hover:opacity-90 transition-opacity">
              PHIVONEX
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <button onClick={() => scrollToSection('hero')} className="hover:text-[#00CFFF] transition-colors focus:outline-none focus:text-[#00CFFF]">Home</button>
            <button onClick={() => scrollToSection('ecosystem')} className="hover:text-[#00CFFF] transition-colors focus:outline-none focus:text-[#00CFFF]">Ecosystem</button>
            <button onClick={() => scrollToSection('genesis-nodes')} className="hover:text-[#00CFFF] transition-colors focus:outline-none focus:text-[#00CFFF]">Genesis Nodes</button>
            <button onClick={() => scrollToSection('phivo')} className="hover:text-[#00CFFF] transition-colors focus:outline-none focus:text-[#00CFFF]">PHIVO Token</button>
            <button onClick={() => scrollToSection('network')} className="hover:text-[#00CFFF] transition-colors focus:outline-none focus:text-[#00CFFF]">Telemetry</button>
            <button onClick={() => scrollToSection('security')} className="hover:text-[#00CFFF] transition-colors focus:outline-none focus:text-[#00CFFF]">Security</button>
            <button onClick={() => scrollToSection('faq')} className="hover:text-[#00CFFF] transition-colors focus:outline-none focus:text-[#00CFFF]">FAQ</button>
          </nav>

          {/* Primary Action */}
          <div className="hidden lg:flex items-center gap-4">
            <button 
              onClick={() => onNavigate(user ? '/app' : '/login')}
              className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#0052D4] via-[#4364F7] to-[#00CFFF] hover:opacity-95 rounded-lg transition-all shadow-[0_0_20px_rgba(0,207,255,0.25)] hover:shadow-[0_0_30px_rgba(0,207,255,0.4)] active:scale-[0.98] cursor-pointer"
            >
              Launch App
            </button>
          </div>

          {/* Mobile Menu Trigger */}
          <div className="flex lg:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-[#00CFFF] transition-colors focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-white/[0.08] bg-[#05070C]/95 backdrop-blur-2xl px-4 pt-4 pb-6 space-y-3">
            <button onClick={() => scrollToSection('hero')} className="block w-full text-left py-2 text-sm text-slate-300 hover:text-[#00CFFF]">Home</button>
            <button onClick={() => scrollToSection('ecosystem')} className="block w-full text-left py-2 text-sm text-slate-300 hover:text-[#00CFFF]">Ecosystem</button>
            <button onClick={() => scrollToSection('genesis-nodes')} className="block w-full text-left py-2 text-sm text-slate-300 hover:text-[#00CFFF]">Genesis Nodes</button>
            <button onClick={() => scrollToSection('phivo')} className="block w-full text-left py-2 text-sm text-slate-300 hover:text-[#00CFFF]">PHIVO Token</button>
            <button onClick={() => scrollToSection('network')} className="block w-full text-left py-2 text-sm text-slate-300 hover:text-[#00CFFF]">Telemetry</button>
            <button onClick={() => scrollToSection('security')} className="block w-full text-left py-2 text-sm text-slate-300 hover:text-[#00CFFF]">Security</button>
            <button onClick={() => scrollToSection('faq')} className="block w-full text-left py-2 text-sm text-slate-300 hover:text-[#00CFFF]">FAQ</button>
            <div className="pt-4 border-t border-white/[0.08]">
              <button 
                onClick={() => { setMobileMenuOpen(false); onNavigate(user ? '/app' : '/login'); }}
                className="w-full px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#0052D4] to-[#4364F7] rounded-lg shadow-lg"
              >
                Launch App
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ----------------------------------------------------------------------
          2. HERO SECTION
         ---------------------------------------------------------------------- */}
      <section id="hero" className="relative pt-12 sm:pt-20 pb-8 sm:pb-12 overflow-hidden">
        {/* Radial Lighting Mesh Backgrounds */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#00CFFF]/10 via-[#0A182F]/40 to-transparent pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-[#4364F7]/10 rounded-full blur-[120px] pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Copy & Actions */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-left">
            
            {/* Unboxed Kicker Label */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00CFFF] animate-ping" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#00CFFF] font-bold">
                VERIFIED WEB3 INFRASTRUCTURE
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1] font-sans text-balance">
              PHIVONEX <br />
              <span className="bg-gradient-to-r from-white via-[#E0F2FE] to-[#00CFFF] bg-clip-text text-transparent">
                Powering a Transparent Node Economy
              </span>
            </h1>

            {/* Body Description */}
            <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed font-normal">
              PHIVONEX is an enterprise-grade Web3 validation network anchored by a hard-capped allocation of 10,000 Genesis Nodes. We power asset verification, epoch rewards, and verifiable digital ecosystem mechanics.
            </p>

            {/* Action CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button 
                onClick={() => onNavigate(user ? '/app' : '/login')}
                className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-[#0052D4] via-[#4364F7] to-[#00CFFF] hover:opacity-95 rounded-lg transition-all shadow-[0_0_25px_rgba(0,207,255,0.3)] hover:shadow-[0_0_35px_rgba(0,207,255,0.5)] flex items-center justify-center gap-2.5 group active:scale-[0.98] cursor-pointer"
              >
                <span>Launch App</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-white" />
              </button>
              
              <button 
                onClick={() => scrollToSection('ecosystem')}
                className="px-8 py-4 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-white bg-[#0B1528]/80 hover:bg-[#12223F] border border-[#00CFFF]/20 hover:border-[#00CFFF]/40 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
              >
                <span>Explore Ecosystem</span>
              </button>
            </div>

            {/* Unboxed Metadata Dot-Separated Kicker */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-4 text-xs text-slate-400 font-mono">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Shield className="w-3.5 h-3.5 text-[#00CFFF]" />
                Server-Validated Ledger
              </span>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <span className="text-slate-300 font-medium">BEP-20 Smart Contract Verified</span>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <span className="text-slate-300 font-medium">10,000 Genesis Node Cap</span>
            </div>

          </div>

          {/* Right Column: Hero PHIVONEX Protocol Infrastructure Visualization */}
          <div className="lg:col-span-5 w-full max-w-4xl mx-auto flex justify-center">
            <div className="relative w-full max-w-md aspect-square rounded-2xl bg-gradient-to-b from-[#0C172C]/90 via-[#070E1A]/95 to-[#05070C] border border-[#00CFFF]/25 p-5 sm:p-6 flex flex-col justify-between overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl group transition-all duration-500 hover:border-[#00CFFF]/45">
              
              {/* Subtle top edge illumination highlight */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00CFFF]/50 to-transparent pointer-events-none" />
              
              {/* Ambient Grid Background */}
              <div className="absolute inset-0 bg-[radial-gradient(#00cfff_1px,transparent_1px)] [background-size:24px_20px] opacity-[0.12] pointer-events-none" />

              {/* Card Header */}
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5 relative z-10">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#00CFFF]" />
                  <span className="text-[11px] font-mono text-slate-300 font-bold tracking-widest uppercase">
                    PROTOCOL INFRASTRUCTURE
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-[#00CFFF] bg-[#00CFFF]/10 border border-[#00CFFF]/20 px-2.5 py-1 rounded-md">
                  <span className="w-1.5 h-1.5 bg-[#00CFFF] rounded-full motion-safe:animate-pulse" />
                  <span>INTEGRITY VERIFIED</span>
                </div>
              </div>

              {/* Central Abstract Protocol Core SVG Visualization */}
              <div className="flex-1 flex items-center justify-center relative py-4 my-1 select-none">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 240 240" fill="none">
                  <defs>
                    <linearGradient id="coreBeamGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00CFFF" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#4364F7" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#00CFFF" stopOpacity="0.1" />
                    </linearGradient>

                    <linearGradient id="coreBeamGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#4364F7" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#00CFFF" stopOpacity="0.2" />
                    </linearGradient>

                    <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#00CFFF" stopOpacity="0.25" />
                      <stop offset="50%" stopColor="#4364F7" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="#05070C" stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Ambient Glow Disk */}
                  <circle cx="120" cy="120" r="90" fill="url(#coreGlow)" />

                  {/* Outer Segmented Orbital Track (Slow counter-clockwise rotation) */}
                  <g className="motion-safe:animate-[spin_35s_linear_infinite] origin-center" style={{ transformOrigin: '120px 120px' }}>
                    <circle cx="120" cy="120" r="88" stroke="#00CFFF" strokeWidth="1" strokeDasharray="6 14" strokeOpacity="0.3" />
                    <circle cx="120" cy="120" r="76" stroke="#4364F7" strokeWidth="1" strokeDasharray="30 8 4 8" strokeOpacity="0.4" />
                  </g>

                  {/* Middle Concentric Ring (Slow clockwise rotation) */}
                  <g className="motion-safe:animate-[spin_25s_linear_infinite] origin-center" style={{ transformOrigin: '120px 120px' }}>
                    <circle cx="120" cy="120" r="62" stroke="url(#coreBeamGrad1)" strokeWidth="1.5" strokeDasharray="18 10 40 10" />
                  </g>

                  {/* Inner Concentric Pulse Ring */}
                  <circle cx="120" cy="120" r="46" stroke="#00CFFF" strokeWidth="1" strokeDasharray="2 4" strokeOpacity="0.5" className="motion-safe:animate-pulse" />

                  {/* Distributed Infrastructure Pathway Beams */}
                  <path d="M 120 120 L 40 45" stroke="url(#coreBeamGrad1)" strokeWidth="1.5" strokeDasharray="4 4" />
                  <path d="M 120 120 L 200 45" stroke="url(#coreBeamGrad2)" strokeWidth="1.5" strokeDasharray="4 4" />
                  <path d="M 120 120 L 200 195" stroke="url(#coreBeamGrad1)" strokeWidth="1.5" strokeDasharray="4 4" />
                  <path d="M 120 120 L 40 195" stroke="url(#coreBeamGrad2)" strokeWidth="1.5" strokeDasharray="4 4" />

                  {/* Infrastructure Nodes / Anchors */}
                  <g>
                    <circle cx="40" cy="45" r="5" fill="#0B1C33" stroke="#00CFFF" strokeWidth="1.5" />
                    <circle cx="40" cy="45" r="2" fill="#00CFFF" />
                    
                    <circle cx="200" cy="45" r="5" fill="#0B1C33" stroke="#4364F7" strokeWidth="1.5" />
                    <circle cx="200" cy="45" r="2" fill="#6FB1FC" />

                    <circle cx="200" cy="195" r="5" fill="#0B1C33" stroke="#00CFFF" strokeWidth="1.5" />
                    <circle cx="200" cy="195" r="2" fill="#00CFFF" />

                    <circle cx="40" cy="195" r="5" fill="#0B1C33" stroke="#4364F7" strokeWidth="1.5" />
                    <circle cx="40" cy="195" r="2" fill="#4364F7" />
                  </g>
                </svg>

                {/* Central Protocol Core Hub Badge */}
                <div className="z-10 bg-[#05070C]/95 border border-[#00CFFF]/40 rounded-xl px-5 py-3.5 text-center backdrop-blur-md shadow-[0_0_25px_rgba(0,207,255,0.2)] flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-[#00CFFF] font-extrabold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00CFFF] motion-safe:animate-ping" />
                    <span>VALIDATION LAYER</span>
                  </div>
                  <div className="text-xs font-mono font-bold text-white tracking-widest uppercase">
                    PHIVONEX CORE
                  </div>
                </div>

                {/* Micro Infrastructure Path Labels */}
                <span className="absolute top-2 left-2 text-[9px] font-mono tracking-wider text-slate-400 bg-[#05070C]/80 border border-white/[0.08] px-2 py-0.5 rounded backdrop-blur-sm">
                  VALIDATION
                </span>
                <span className="absolute top-2 right-2 text-[9px] font-mono tracking-wider text-slate-400 bg-[#05070C]/80 border border-white/[0.08] px-2 py-0.5 rounded backdrop-blur-sm">
                  SECURE LEDGER
                </span>
                <span className="absolute bottom-2 left-2 text-[9px] font-mono tracking-wider text-slate-400 bg-[#05070C]/80 border border-white/[0.08] px-2 py-0.5 rounded backdrop-blur-sm">
                  SETTLEMENT
                </span>
                <span className="absolute bottom-2 right-2 text-[9px] font-mono tracking-wider text-slate-400 bg-[#05070C]/80 border border-white/[0.08] px-2 py-0.5 rounded backdrop-blur-sm">
                  NETWORK SYNC
                </span>
              </div>

              {/* Card Footer Micro Technical Statuses */}
              <div className="border-t border-white/[0.08] pt-3.5 flex items-center justify-between text-[11px] font-mono text-slate-400 relative z-10">
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Lock className="w-3.5 h-3.5 text-[#00CFFF]" />
                  <span>SECURE VALIDATION</span>
                </span>
                <span className="text-[#00CFFF] font-bold tracking-wider">
                  LEDGER CONSENSUS
                </span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          3. REAL PROTOCOL METRICS HIGHLIGHT BAR
         ---------------------------------------------------------------------- */}
      <section className="bg-[#070B14]/90 border-y border-white/[0.08] py-8 sm:py-10 relative z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 items-center">
            
            {/* Metric 1 */}
            <div className="space-y-1.5 text-center sm:text-left">
              <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider font-semibold block">Max PHIVO Supply</span>
              <div className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                {stats.maxSupply}
              </div>
            </div>

            {/* Metric 2 */}
            <div className="space-y-1.5 text-center sm:text-left border-t sm:border-t-0 sm:border-l border-white/[0.08] pt-4 sm:pt-0 pl-0 sm:pl-6">
              <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider font-semibold block">Genesis Node Cap</span>
              <div className="text-lg sm:text-xl font-extrabold text-white font-mono tracking-tight">
                10,000 Hard-Capped Nodes
              </div>
            </div>

            {/* Metric 3 */}
            <div className="space-y-1.5 text-center sm:text-left border-t sm:border-t-0 sm:border-l border-white/[0.08] pt-4 sm:pt-0 pl-0 sm:pl-6">
              <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider font-semibold block">Internal Swap Rate</span>
              <div className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                {stats.conversionRate !== null ? `$${stats.conversionRate.toFixed(2)} USDT` : 'Rate Unavailable'}
              </div>
            </div>

          </div>

          {!isConnected && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-amber-400 font-mono">
              <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
              <span>Network syncing. Displaying authoritative snapshot parameters.</span>
            </div>
          )}

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          4. HOW PHIVONEX WORKS (4-Step Architecture)
         ---------------------------------------------------------------------- */}
      <section id="ecosystem" className="py-24 sm:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00CFFF] font-bold">ARCHITECTURE</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              A Streamlined Path to Decentralized Performance
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Deploy secure Genesis Nodes without managing complex hardware clusters. Our system abstracts protocol complexity into intuitive, server-validated interfaces.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Step 1 */}
            <div className="group bg-gradient-to-b from-[#0B1528]/80 to-[#070B14]/90 border border-[#00CFFF]/15 hover:border-[#00CFFF]/40 rounded-xl p-6 space-y-4 transition-all duration-300 hover:-translate-y-1 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00CFFF]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF] group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">STEP 01</div>
              <h3 className="text-base font-bold text-white">Create Account</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Register on our secure platform. Instantly obtain unique static BNB & USDT wallet deposit addresses provisioned specifically for your account.
              </p>
            </div>

            {/* Step 2 */}
            <div className="group bg-gradient-to-b from-[#0B1528]/80 to-[#070B14]/90 border border-[#00CFFF]/15 hover:border-[#00CFFF]/40 rounded-xl p-6 space-y-4 transition-all duration-300 hover:-translate-y-1 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00CFFF]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF] group-hover:scale-110 transition-transform">
                <Server className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">STEP 02</div>
              <h3 className="text-base font-bold text-white">Activate Genesis Node</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Unlock your node package using your USDT wallet balance. Your unique Genesis identifier is mapped directly to our server-side ledger.
              </p>
            </div>

            {/* Step 3 */}
            <div className="group bg-gradient-to-b from-[#0B1528]/80 to-[#070B14]/90 border border-[#00CFFF]/15 hover:border-[#00CFFF]/40 rounded-xl p-6 space-y-4 transition-all duration-300 hover:-translate-y-1 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00CFFF]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF] group-hover:scale-110 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">STEP 03</div>
              <h3 className="text-base font-bold text-white">Participate in Network</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your activated node participates in network validation per epoch. Network activity is systematically logged on our public-facing ledger.
              </p>
            </div>

            {/* Step 4 */}
            <div className="group bg-gradient-to-b from-[#0B1528]/80 to-[#070B14]/90 border border-[#00CFFF]/15 hover:border-[#00CFFF]/40 rounded-xl p-6 space-y-4 transition-all duration-300 hover:-translate-y-1 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00CFFF]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-10 h-10 rounded-lg bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center text-[#00CFFF] group-hover:scale-110 transition-transform">
                <Coins className="w-5 h-5" />
              </div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">STEP 04</div>
              <h3 className="text-base font-bold text-white">Manage PHIVO / USDT</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Accrue native PHIVO tokens, swap them instantly inside your secure wallet ledger at configured rates, and request prompt BEP-20 payouts.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          5. GENESIS NODE ALLOCATION SECTION
         ---------------------------------------------------------------------- */}
      <section id="genesis-nodes" className="py-24 sm:py-32 bg-[#070B14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-6 text-left">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00CFFF] font-bold">LIMITED ALLOCATION</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              A Fixed Supply of 10,000 Genesis Nodes
            </h2>
            
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              We ensure platform stability and scarcity by enforcing a hard maximum of 10,000 Genesis Nodes. Once fully allocated, no additional Genesis Nodes can ever be minted.
            </p>

            <ul className="space-y-4 text-slate-300 text-sm">
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#00CFFF] shrink-0" />
                <span><strong className="font-bold text-white">Hard-Capped Allocation:</strong> Strict 10,000 node cap protects network rewards from inflationary dilution.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#00CFFF] shrink-0" />
                <span><strong className="font-bold text-white">Server-Managed Virtualization:</strong> Zero complex local hosting. Server-side architecture manages node execution automatically.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#00CFFF] shrink-0" />
                <span><strong className="font-bold text-white">Live Allocation Feed:</strong> View node allocation parameters, remaining supply, and epoch status in real time.</span>
              </li>
            </ul>

            <div className="pt-2">
              <button 
                onClick={() => onNavigate('/register')}
                className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-white bg-[#0B1528] hover:bg-[#12223F] border border-[#00CFFF]/20 hover:border-[#00CFFF]/40 rounded-lg transition-all cursor-pointer"
              >
                View Node Allocation Status
              </button>
            </div>
          </div>

          {/* Allocation Progress Panel */}
          <div className="bg-gradient-to-b from-[#0B1528] to-[#070B14] border border-[#00CFFF]/20 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl backdrop-blur-xl">
            <div className="flex justify-between items-center pb-4 border-b border-white/[0.08]">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">GENESIS NODE ALLOCATION</h3>
              <span className="text-[10px] font-mono text-[#00CFFF] bg-[#00CFFF]/10 px-2 py-0.5 rounded font-bold">HARD-CAPPED</span>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between border-b border-white/[0.05] pb-3 text-xs font-mono">
                <span className="text-slate-400 font-medium">MAXIMUM ALLOCATION</span>
                <span className="text-white font-bold tabular-nums">10,000 Genesis Nodes</span>
              </div>
              <div className="flex justify-between border-b border-white/[0.05] pb-3 text-xs font-mono">
                <span className="text-slate-400 font-medium">AVAILABLE GENESIS NODES</span>
                <span className="text-white font-bold tabular-nums">
                  {stats.availableNodes !== undefined ? stats.availableNodes.toLocaleString() : 'Loading...'}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/[0.05] pb-3 text-xs font-mono">
                <span className="text-slate-400 font-medium">NODE PACKAGE PRICE</span>
                <span className="text-white font-bold tabular-nums">$1,000.00 USDT</span>
              </div>
            </div>

            {/* Progress Fill Indicator */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs text-slate-400 font-mono">
                <span>ALLOCATION FILL RATE</span>
                <span className="text-[#00CFFF] font-bold tabular-nums">{stats.allocatedPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2.5 bg-[#05070C] rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-[#00CFFF] via-[#4364F7] to-[#0052D4] transition-all duration-1000 shadow-[0_0_10px_rgba(0,207,255,0.5)]"
                  style={{ width: `${Math.max(2, stats.allocatedPercent)}%` }}
                />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          6. PHIVO TOKEN & ON-CHAIN VERIFICATION SECTION
         ---------------------------------------------------------------------- */}
      <section id="phivo" className="py-24 sm:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            {/* Conversion Ratio Module */}
            <div className="bg-gradient-to-br from-[#0B1528] to-[#05070C] border border-[#00CFFF]/20 rounded-2xl p-8 space-y-6 order-last lg:order-first shadow-xl">
              <div className="flex justify-between items-center pb-4 border-b border-white/[0.08]">
                <span className="text-xs font-mono text-slate-400 font-semibold">NATIVE LEDGER CONVERSION</span>
                <span className="text-[10px] font-mono text-[#00CFFF] bg-[#00CFFF]/10 px-2.5 py-1 rounded font-bold">ACTIVE RATE</span>
              </div>

              <div className="space-y-4">
                <div className="text-center py-6 bg-[#05070C]/90 border border-[#00CFFF]/10 rounded-xl space-y-2">
                  <span className="text-xs text-slate-400 font-mono font-medium">CONVERSION RATIO</span>
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                    {stats.conversionRate !== null ? `1.00 PHIVO = $${stats.conversionRate.toFixed(2)} USDT` : 'Rate Not Configured'}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider block">Current Administrative Configured Rate</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed text-center">
                  All transactions and reward balances inside the PHIVONEX ledger retain strict rate integrity. Converts instantly within the wallet ledger based on the active configured rate.
                </p>
              </div>
            </div>

            {/* PHIVO Description */}
            <div className="space-y-6 text-left">
              <span className="text-xs font-mono uppercase tracking-widest text-[#00CFFF] font-bold">ECOSYSTEM ASSET</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                PHIVO: The Foundation of Ecosystem Activity
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                PHIVO is the native ecosystem asset powering node validation rewards on the PHIVONEX network. While node rewards are paid in PHIVO, separate referral, matching, and promotional incentives are governed by their own configured server-side financial ledger rules.
              </p>

              <div className="space-y-4 text-sm text-slate-300">
                <div className="flex gap-3">
                  <Coins className="w-5 h-5 text-[#00CFFF] shrink-0" />
                  <span><strong className="font-bold text-white">Consistent Naming Integrity:</strong> All ecosystem assets are strictly designated as PHIVO.</span>
                </div>
                <div className="flex gap-3">
                  <RefreshCw className="w-5 h-5 text-[#00CFFF] shrink-0" />
                  <span><strong className="font-bold text-white">Instant Wallet Conversion:</strong> Swap accrued PHIVO rewards directly to stable USDT inside your secure dashboard instantly.</span>
                </div>
              </div>
            </div>

          </div>

          {/* On-Chain Smart Contract Verification Block */}
          <div className="mt-12 bg-gradient-to-r from-[#0B172B] via-[#09101C] to-[#05070D] border border-[#00CFFF]/20 rounded-2xl p-6 sm:p-8 relative overflow-hidden text-left shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#00CFFF]/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              
              <div className="space-y-4 max-w-2xl">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-mono tracking-wider text-[#00CFFF] bg-[#00CFFF]/10 px-2.5 py-1 rounded-md uppercase font-bold">
                    On-Chain Verification
                  </span>
                  <span className="text-xs font-mono tracking-wider text-[#32D583] bg-[#32D583]/10 px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Source Code Verified
                  </span>
                </div>
                
                <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-sans">
                  PHIVO BEP-20 Smart Contract
                </h3>
                
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  The PHIVO token rules, fixed supply limits, and economic balance allocations are permanently recorded and hardcoded on the <strong>BNB Smart Chain (BEP-20)</strong>. This ledger state is publicly readable, verified, and audited.
                </p>

                {/* Contract address display row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider font-semibold">Authoritative Contract Address</span>
                    <span className="font-mono text-xs sm:text-sm text-[#00CFFF] bg-[#05070C] px-3.5 py-2 rounded-lg border border-[#00CFFF]/15 break-all select-all font-semibold">
                      {PHIVONEX_TOKEN_CONFIG.contractAddress}
                    </span>
                  </div>

                  <button
                    onClick={copyContractAddress}
                    className="sm:self-end px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.1] flex items-center justify-center gap-2 text-xs font-bold tracking-wide transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]"
                  >
                    {contractCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#32D583]" />
                        <span className="text-[#32D583] font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#00CFFF]" />
                        <span>Copy Address</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* External Explorer Link */}
              <div className="flex flex-col justify-center shrink-0 gap-3">
                <a
                  href={`https://bscscan.com/address/${PHIVONEX_TOKEN_CONFIG.contractAddress}#code`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-6 py-3.5 rounded-lg bg-gradient-to-r from-[#00CFFF]/20 via-[#4364F7]/20 to-[#00CFFF]/20 hover:from-[#00CFFF]/30 hover:to-[#4364F7]/30 text-[#00CFFF] border border-[#00CFFF]/40 hover:border-[#00CFFF]/60 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(0,207,255,0.1)] active:scale-[0.98]"
                >
                  <span>View on BscScan</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <span className="text-[10px] text-slate-400 max-w-[280px] leading-relaxed block text-center md:text-left">
                  * Public contract registry verification only. BscScan is an independent third-party block explorer.
                </span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          7. NETWORK & PUBLIC LEDGER FEED SECTION
         ---------------------------------------------------------------------- */}
      <section id="network" className="py-24 sm:py-32 bg-[#070B14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00CFFF] font-bold">PUBLIC TRANSPARENCY</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Public Network & Ledger Transparency
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              PHIVONEX provides public network activity transparency. View node activation events, telemetry updates, and epoch logs in real time.
            </p>
          </div>

          {/* Real-time Ledger Feed Module */}
          <div className="bg-[#09101C] border border-[#00CFFF]/20 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-6 bg-[#0B1528] border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Globe className="w-5 h-5 text-[#00CFFF]" />
                <h3 className="font-bold text-white font-mono text-sm uppercase tracking-wider">Public Telemetry Activity</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono font-semibold">
                CONNECTED STATE · TIMESTAMPS DETERMINISTIC
              </span>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {events && events.length > 0 ? (
                events.slice(0, 5).map((evt: any) => (
                  <div key={evt.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#0C1929] transition-colors">
                    <div className="space-y-1 text-left">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white font-sans">
                        <span className="w-1.5 h-1.5 bg-[#00CFFF] rounded-full" />
                        {evt.title}
                      </div>
                      <p className="text-xs text-slate-400 max-w-2xl">{evt.description}</p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-slate-400 shrink-0 self-end sm:self-center">
                      {evt.publicId && <span>ID #{evt.publicId}</span>}
                      <span aria-hidden="true" className="text-slate-700">·</span>
                      <span>{formatRelativeTime(evt.timestamp)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 font-mono">
                  No public telemetry blocks registered yet. System active and listening.
                </div>
              )}
            </div>

            <div className="p-4 bg-[#0B1528] border-t border-white/[0.08] text-center">
              <button 
                onClick={() => onNavigate('/network')}
                className="text-xs font-bold text-[#00CFFF] hover:underline flex items-center justify-center gap-1.5 mx-auto uppercase tracking-wider cursor-pointer"
              >
                <span>Access Public Telemetry Dashboard</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          8. ECOSYSTEM FEATURE-SET (10 Modular Pillars)
         ---------------------------------------------------------------------- */}
      <section className="py-24 sm:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00CFFF] font-bold">SYSTEM PILLARS</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Comprehensive Feature-Set Engineered for Security
            </h2>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Ten modular building blocks coordinating to provide an unmatched, enterprise-grade Web3 validation infrastructure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* 1. Genesis Nodes */}
            <div className="bg-gradient-to-b from-[#0B1528] to-[#070B14] border border-[#00CFFF]/15 hover:border-[#00CFFF]/35 rounded-xl p-6 space-y-3 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase tracking-wider">01. Genesis Nodes</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Allocate limited virtual computing verification keys hard-capped globally to 10,000 units.
              </p>
            </div>

            {/* 2. Referral Network */}
            <div className="bg-gradient-to-b from-[#0B1528] to-[#070B14] border border-[#00CFFF]/15 hover:border-[#00CFFF]/35 rounded-xl p-6 space-y-3 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase tracking-wider">02. Referral Network</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect and expand our ecosystem with secure genealogy structures, paying a $50 direct referral commission per eligible activated node.
              </p>
            </div>

            {/* 3. Binary Matching */}
            <div className="bg-gradient-to-b from-[#0B1528] to-[#070B14] border border-[#00CFFF]/15 hover:border-[#00CFFF]/35 rounded-xl p-6 space-y-3 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase tracking-wider">03. Binary Matching</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Participate in dynamically configured matching tiers (qualification required). Payouts calculated daily with a maximum daily matching payout of $5,000.
              </p>
            </div>

            {/* 4. PHIVO Rewards */}
            <div className="bg-gradient-to-b from-[#0B1528] to-[#070B14] border border-[#00CFFF]/15 hover:border-[#00CFFF]/35 rounded-xl p-6 space-y-3 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase tracking-wider">04. PHIVO Rewards</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Validation rewards issued per epoch directly to active node balances based on configured reward epochs.
              </p>
            </div>

            {/* 5. USDT Wallet */}
            <div className="bg-gradient-to-b from-[#0B1528] to-[#070B14] border border-[#00CFFF]/15 hover:border-[#00CFFF]/35 rounded-xl p-6 space-y-3 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase tracking-wider">05. USDT Wallet</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Deposit and request BEP-20 standard USDT transactions with instant transaction mapping.
              </p>
            </div>

            {/* 6. Internal Swap */}
            <div className="bg-gradient-to-b from-[#0B1528] to-[#070B14] border border-[#00CFFF]/15 hover:border-[#00CFFF]/35 rounded-xl p-6 space-y-3 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase tracking-wider">06. Internal Swap</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Convert PHIVO rewards directly to stable USDT inside the wallet ledger at admin-configured ratios.
              </p>
            </div>

            {/* 7. Notifications */}
            <div className="bg-gradient-to-b from-[#0B1528] to-[#070B14] border border-[#00CFFF]/15 hover:border-[#00CFFF]/35 rounded-xl p-6 space-y-3 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase tracking-wider">07. Notifications</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Receive real-time on-screen and automated email notifications for logins, deposits, and rewards.
              </p>
            </div>

            {/* 8. Transparent Ledger */}
            <div className="bg-gradient-to-b from-[#0B1528] to-[#070B14] border border-[#00CFFF]/15 hover:border-[#00CFFF]/35 rounded-xl p-6 space-y-3 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase tracking-wider">08. Transparent Ledger</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                A public network logging system that records transaction logs, reward state, and epoch events.
              </p>
            </div>

            {/* 9. Security Protocol */}
            <div className="bg-gradient-to-b from-[#0B1528] to-[#070B14] border border-[#00CFFF]/15 hover:border-[#00CFFF]/35 rounded-xl p-6 space-y-3 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase tracking-wider">09. Security Protocol</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Server-side authorization walls protecting client environments from sensitive credential exposure.
              </p>
            </div>

            {/* 10. Reconciliation */}
            <div className="bg-gradient-to-b from-[#0B1528] to-[#070B14] border border-[#00CFFF]/15 hover:border-[#00CFFF]/35 rounded-xl p-6 space-y-3 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase tracking-wider">10. Reconciliation Audit</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                System checks audit the entire state machine continuously for financial ledger balance.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          9. SECURITY & PROTOCOL INTEGRITY SECTION
         ---------------------------------------------------------------------- */}
      <section id="security" className="py-24 sm:py-32 bg-[#070B14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-6 text-left">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00CFFF] font-bold">HARDENED DEFENSES</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
              <Shield className="w-8 h-8 text-[#00CFFF] shrink-0" />
              Advanced Security Protocol Walls
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Every financial ledger update, commission calculation, and swap operation executes exclusively inside isolated server-side frameworks.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 text-slate-300 text-sm">
              <div className="space-y-1">
                <span className="text-[#00CFFF] font-mono text-xs uppercase font-bold">Server-Side Authorization</span>
                <p className="text-xs text-slate-400">Frontend controls never submit raw balance changes. Every transaction requires authoritative server checks.</p>
              </div>
              <div className="space-y-1">
                <span className="text-[#00CFFF] font-mono text-xs uppercase font-bold">Transaction Idempotency</span>
                <p className="text-xs text-slate-400">Database transactions are protected with unique idempotency keys to prevent double-spending.</p>
              </div>
              <div className="space-y-1">
                <span className="text-[#00CFFF] font-mono text-xs uppercase font-bold">Reconciliation Scans</span>
                <p className="text-xs text-slate-400">Continuous balance integrity checks automatically audit and flag any ledger variance instantly.</p>
              </div>
              <div className="space-y-1">
                <span className="text-[#00CFFF] font-mono text-xs uppercase font-bold">Protected Secrets</span>
                <p className="text-xs text-slate-400">Cryptographic API keys and seed material are strictly isolated and never exposed to standard browser memory.</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#0B1528] to-[#05070C] border border-[#00CFFF]/20 rounded-2xl p-6 sm:p-8 space-y-6 flex flex-col justify-between shadow-2xl">
            <div className="flex items-center gap-2 text-xs text-[#00CFFF] font-mono font-bold">
              <Lock className="w-4 h-4" />
              <span>CRYPTOGRAPHIC LEDGER INTEGRITY</span>
            </div>

            <div className="bg-[#05070C]/90 border border-white/[0.08] rounded-xl p-4 space-y-2 font-mono text-xs">
              <div className="text-slate-400 font-semibold">LEDGER STATE AUDIT:</div>
              <div className="text-emerald-400 flex items-center gap-2 font-bold">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                VERIFIED CONSTANT INTEGRITY
              </div>
              <div className="text-slate-400 pt-2 text-[11px] leading-relaxed">
                System state machines scan for ledger variances. Security parameters verified systematically.
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
              SYSTEM: PHIVONEX SECURE CORE v1.0.1 // SERVER-VALIDATED LEDGER SYSTEM
            </p>
          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          10. RESPONSIBLE DISCLOSURE & RISK ADVISORY
         ---------------------------------------------------------------------- */}
      <section className="py-16 bg-[#05070C] border-t border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#09101C] border border-white/[0.08] rounded-xl p-6 space-y-3 max-w-4xl mx-auto text-left">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 font-mono">
              Responsible Disclosure & Risk Advisory
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Decentralized infrastructure models and node networks present technological risks. Uptime performance, rewards allocation cycles, and swap rates are subject strictly to rules configured and verified by system administration. All rewards accrued within the PHIVONEX ecosystem are contingent on qualifying validator operations, deterministic network requirements, and active compliance guidelines. We make no guarantees of consistent profitability or permanent pricing liquidity. Asset value fluctuations on the blockchain carry inherent risk. Ensure you thoroughly review applicable terms of service and risk policies prior to activating node packages.
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------------
          11. FAQ ACCORDION SECTION
         ---------------------------------------------------------------------- */}
      <section id="faq" className="py-24 sm:py-32 bg-[#070B14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#00CFFF] font-bold">HELP & SUPPORT</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Find concise, authoritative explanations on Genesis Nodes, reward mechanics, and system security.
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, idx) => (
              <div 
                key={idx} 
                className="bg-[#09101C] border border-[#00CFFF]/15 rounded-xl overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left text-sm sm:text-base font-bold text-white hover:bg-[#0C1929] transition-colors focus:outline-none cursor-pointer"
                  aria-expanded={openFaq === idx}
                >
                  <span className="pr-4">{item.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-[#00CFFF] shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-5 pt-2 border-t border-white/[0.06] text-xs sm:text-sm text-slate-300 leading-relaxed text-left">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          12. FOOTER
         ---------------------------------------------------------------------- */}
      <footer className="bg-[#05070C] border-t border-white/[0.08] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          
          <div className="space-y-4 col-span-2 md:col-span-1 text-left">
            <div className="flex items-center gap-2">
              <PhivonexSymbol size={24} animated={false} glow={false} />
              <span className="text-lg font-extrabold tracking-wider text-white font-mono">
                PHIVONEX
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Premium, high-performance node infrastructure and decentralized ledger transparency systems for Web3 validation audits.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Ecosystem</h4>
            <div className="flex flex-col gap-2 text-xs text-slate-400 font-medium">
              <button onClick={() => scrollToSection('hero')} className="hover:text-[#00CFFF] text-left transition-colors cursor-pointer">Home</button>
              <button onClick={() => scrollToSection('ecosystem')} className="hover:text-[#00CFFF] text-left transition-colors cursor-pointer">Ecosystem</button>
              <button onClick={() => scrollToSection('genesis-nodes')} className="hover:text-[#00CFFF] text-left transition-colors cursor-pointer">Genesis Nodes</button>
            </div>
          </div>

          <div className="space-y-3 text-left">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Security</h4>
            <div className="flex flex-col gap-2 text-xs text-slate-400 font-medium">
              <button onClick={() => scrollToSection('security')} className="hover:text-[#00CFFF] text-left transition-colors cursor-pointer">Integrity Protocol</button>
              <button onClick={() => scrollToSection('faq')} className="hover:text-[#00CFFF] text-left transition-colors cursor-pointer">FAQ Support</button>
              <button onClick={() => onNavigate('/network')} className="hover:text-[#00CFFF] text-left transition-colors cursor-pointer">Telemetry Ledger</button>
              <a
                href={`https://bscscan.com/address/${PHIVONEX_TOKEN_CONFIG.contractAddress}#code`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#00CFFF] text-left transition-colors flex items-center gap-1"
              >
                <span>Verify PHIVO on BscScan</span>
                <ExternalLink className="w-3 h-3 text-[#00CFFF]" />
              </a>
            </div>
          </div>

          <div className="space-y-3 text-left">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono">Legal & Risk</h4>
            <div className="flex flex-col gap-2 text-xs text-slate-400 font-medium">
              <button onClick={() => onNavigate('/register')} className="hover:text-[#00CFFF] text-left transition-colors cursor-pointer">Terms of Service</button>
              <button onClick={() => onNavigate('/login')} className="hover:text-[#00CFFF] text-left transition-colors cursor-pointer">Privacy Policy</button>
              <button onClick={() => scrollToSection('faq')} className="hover:text-[#00CFFF] text-left transition-colors cursor-pointer">Risk Disclosures</button>
            </div>
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-white/[0.05] pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-mono">
          <span>&copy; {new Date().getFullYear()} PHIVONEX. All Rights Reserved.</span>
          <span className="text-[#00CFFF] font-semibold">Security Audit Verified</span>
        </div>
      </footer>

    </div>
  );
};
