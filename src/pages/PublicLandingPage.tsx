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
  Compass,
  CheckCircle2,
  Lock,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  TrendingUp,
  RefreshCw,
  Globe,
  Award,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { usePublicNetwork } from '../hooks/usePublicNetwork';
import { PhivonexSymbol } from '../components/brand/PhivonexSymbol';
import { PHIVONEX_TOKEN_CONFIG } from '../server/config/tokenConfig';

interface PublicLandingPageProps {
  onNavigate: (route: string) => void;
  user: any;
}

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ onNavigate, user }) => {
  const { summary, events, isConnected, loading } = usePublicNetwork();

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
    conversionRate: typeof summary.conversionRateUsd === 'number' ? summary.conversionRateUsd : 0.10,
    epoch: summary.currentRewardEpoch || 1,
    allocatedPercent: summary.allocationPercent || 0,
    availableNodes: summary.availableNodes || 0
  };

  const faqItems = [
    {
      q: 'What is PHIVONEX?',
      a: 'PHIVONEX is a next-generation decentralized infrastructure network powering the next wave of Web3 applications. By utilizing a fixed supply of Genesis Nodes, we establish a robust, reliable, and high-performance ecosystem for securing and validating digital assets.'
    },
    {
      q: 'What is a Genesis Node?',
      a: 'A Genesis Node is a key infrastructure identifier within the PHIVONEX network. There is a fixed maximum of 10,000 Genesis Nodes. Activating a node allows operators to directly participate in the network, earning PHIVO rewards based on configured reward epochs.'
    },
    {
      q: 'What is PHIVO?',
      a: 'PHIVO is the native ecosystem asset of PHIVONEX, distributed primarily as node validation rewards. Other incentives, such as referral, matching, and promotional rewards, are governed by separate configured financial ledger rules.'
    },
    {
      q: 'How does PHIVO → USDT work?',
      a: 'PHIVONEX features an integrated internal swap module that allows users to convert accumulated PHIVO rewards into USDT. All conversions are performed instantly inside the secure wallet based on the current configured rate. Historical swaps retain the rate recorded at execution.'
    },
    {
      q: 'How are rewards calculated?',
      a: 'Node rewards are distributed per epoch based on real-time node activity, network participation, and configured business rules. Rewards depend on actual qualified activity.'
    },
    {
      q: 'Is PHIVONEX transparent?',
      a: 'Yes, absolutely. PHIVONEX provides a transparent public ledger where node activations, reward epochs, and swap events are systematically logged and publicly visible in our ledger feed.'
    },
    {
      q: 'How is user security handled?',
      a: 'We implement rigorous, enterprise-grade security. All critical operations—including funds ledgering, withdrawals, and swap settlements—are validated server-side. Sensitive API keys and internal secrets are stored exclusively on our secure servers, never exposed to client browsers.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#05070C] text-[#F7FAFC] font-sans antialiased selection:bg-[#00CFFF]/20 selection:text-[#00CFFF]">
      
      {/* ----------------------------------------------------------------------
          1. HEADER / NAVIGATION (Sticky)
         ---------------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#05070C]/85 border-b border-[#00CFFF]/10 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          
          {/* Zone 1: Single element brand wordmark (No badges, no commentary) */}
          <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <PhivonexSymbol size={30} animated={true} glow={true} />
            <span className="text-xl sm:text-2xl font-extrabold tracking-wider bg-gradient-to-r from-[#F7FAFC] to-[#00CFFF] bg-clip-text text-transparent font-mono">
              PHIVONEX
            </span>
          </div>

          {/* Zone 2: Navigation links */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-300">
            <button onClick={() => scrollToSection('hero')} className="hover:text-[#00CFFF] transition-colors">Home</button>
            <button onClick={() => scrollToSection('ecosystem')} className="hover:text-[#00CFFF] transition-colors">Ecosystem</button>
            <button onClick={() => scrollToSection('genesis-nodes')} className="hover:text-[#00CFFF] transition-colors">Genesis Nodes</button>
            <button onClick={() => scrollToSection('phivo')} className="hover:text-[#00CFFF] transition-colors">PHIVO</button>
            <button onClick={() => scrollToSection('network')} className="hover:text-[#00CFFF] transition-colors">Network</button>
            <button onClick={() => scrollToSection('security')} className="hover:text-[#00CFFF] transition-colors">Security</button>
            <button onClick={() => scrollToSection('faq')} className="hover:text-[#00CFFF] transition-colors">FAQ</button>
          </nav>

          {/* Zone 3: Primary CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <button 
              onClick={() => onNavigate(user ? '/app' : '/login')}
              className="px-6 py-2.5 text-xs font-semibold tracking-wide text-white bg-gradient-to-r from-[#0052D4] to-[#4364F7] hover:from-[#4364F7] hover:to-[#6FB1FC] rounded-lg transition-all shadow-[0_0_15px_rgba(0,207,255,0.2)]"
            >
              Launch App
            </button>
          </div>

          {/* Mobile hamburger menu trigger */}
          <div className="flex lg:hidden">
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-[#00CFFF] transition-colors"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#00CFFF]/10 bg-[#05070C] px-4 pt-4 pb-6 space-y-3">
            <button onClick={() => scrollToSection('hero')} className="block w-full text-left py-2 text-slate-300 hover:text-[#00CFFF]">Home</button>
            <button onClick={() => scrollToSection('ecosystem')} className="block w-full text-left py-2 text-slate-300 hover:text-[#00CFFF]">Ecosystem</button>
            <button onClick={() => scrollToSection('genesis-nodes')} className="block w-full text-left py-2 text-slate-300 hover:text-[#00CFFF]">Genesis Nodes</button>
            <button onClick={() => scrollToSection('phivo')} className="block w-full text-left py-2 text-slate-300 hover:text-[#00CFFF]">PHIVO</button>
            <button onClick={() => scrollToSection('network')} className="block w-full text-left py-2 text-slate-300 hover:text-[#00CFFF]">Network</button>
            <button onClick={() => scrollToSection('security')} className="block w-full text-left py-2 text-slate-300 hover:text-[#00CFFF]">Security</button>
            <button onClick={() => scrollToSection('faq')} className="block w-full text-left py-2 text-slate-300 hover:text-[#00CFFF]">FAQ</button>
            <div className="pt-4 border-t border-[#00CFFF]/10">
              <button 
                onClick={() => { setMobileMenuOpen(false); onNavigate(user ? '/app' : '/login'); }}
                className="w-full px-4 py-2.5 text-center text-xs font-semibold text-white bg-gradient-to-r from-[#0052D4] to-[#4364F7] rounded-lg"
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
      <section id="hero" className="relative pt-12 pb-24 sm:pb-32 overflow-hidden">
        {/* Subtle Background meshes */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0A182F] via-[#05070C] to-[#05070C] pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#00CFFF]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-7 space-y-6 text-left">
            
            {/* Tiny pure text indicator (no enclosing badges or capsules) */}
            <div className="text-xs font-mono uppercase tracking-widest text-[#00CFFF] font-bold">
              PHIVO Ecosystem
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight font-sans text-wrap: balance">
              PHIVONEX <br />
              <span className="bg-gradient-to-r from-[#00CFFF] via-[#4364F7] to-[#00CFFF] bg-clip-text text-transparent">
                Powering a Transparent Node Economy
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
              PHIVONEX is a high-performance Web3 infrastructure system built around a fixed maximum of 10,000 Genesis Nodes. We secure digital assets and validate high-integrity processes with a transparent public ledger.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button 
                onClick={() => onNavigate(user ? '/app' : '/login')}
                className="px-8 py-3.5 text-sm font-semibold tracking-wide text-white bg-gradient-to-r from-[#0052D4] to-[#4364F7] hover:from-[#4364F7] hover:to-[#6FB1FC] rounded-lg transition-all shadow-[0_0_20px_rgba(0,207,255,0.15)] flex items-center justify-center gap-2 group animate-pulse"
              >
                Launch App
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => scrollToSection('ecosystem')}
                className="px-8 py-3.5 text-sm font-semibold tracking-wide text-slate-300 hover:text-white bg-[#0B1528] hover:bg-[#12223F] border border-[#00CFFF]/20 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                Explore Ecosystem
              </button>
            </div>

            {/* Unboxed inline metadata */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-6 text-xs text-slate-500 font-mono">
              <span>Stable Core Engine</span>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <span>Server-Validated Financial Ledger</span>
              <span aria-hidden="true" className="text-slate-700">·</span>
              <span>Secure Blockchain Integration</span>
            </div>

          </div>

          {/* Premium CSS visualization slot as fallback for image generator */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md aspect-square rounded-2xl bg-gradient-to-b from-[#09172B] to-[#05070C] border border-[#00CFFF]/15 p-6 flex flex-col justify-between overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-[#00CFFF]/[0.02] bg-[radial-gradient(#00cfff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-[#00CFFF]/10 pb-4">
                <span className="text-xs font-mono text-slate-500">SYSTEM TELEMETRY</span>
                <span className="flex items-center gap-1.5 text-xs text-[#00CFFF] font-mono">
                  <span className="w-1.5 h-1.5 bg-[#00CFFF] rounded-full animate-pulse" />
                  REAL-TIME SYNC
                </span>
              </div>

              {/* Graphic mesh with SVG lines and nodes */}
              <div className="flex-1 flex items-center justify-center relative py-6">
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 200">
                  <defs>
                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#00CFFF" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#4364F7" stopOpacity="0.8" />
                    </linearGradient>
                  </defs>
                  
                  {/* Central Node Circle */}
                  <circle cx="100" cy="100" r="30" fill="#0B1C33" stroke="#00CFFF" strokeWidth="1" strokeDasharray="3 3" />
                  <circle cx="100" cy="100" r="8" fill="#00CFFF" />

                  {/* Satellite Node Lines */}
                  <line x1="100" y1="100" x2="40" y2="50" stroke="url(#lineGrad)" strokeWidth="1" />
                  <line x1="100" y1="100" x2="160" y2="60" stroke="url(#lineGrad)" strokeWidth="1" />
                  <line x1="100" y1="100" x2="150" y2="150" stroke="url(#lineGrad)" strokeWidth="1" />
                  <line x1="100" y1="100" x2="50" y2="140" stroke="url(#lineGrad)" strokeWidth="1" />

                  {/* Satellite Nodes */}
                  <circle cx="40" cy="50" r="5" fill="#4364F7" />
                  <circle cx="160" cy="60" r="6" fill="#00CFFF" />
                  <circle cx="150" cy="150" r="4" fill="#6FB1FC" />
                  <circle cx="50" cy="140" r="5" fill="#00CFFF" />
                </svg>

                <div className="z-10 bg-[#05070C]/90 border border-[#00CFFF]/20 rounded-lg p-3 text-center space-y-1">
                  <div className="text-xl font-bold tracking-tight text-white font-mono tabular-nums">
                    {summary.activeNodes ? `${summary.activeNodes} / 10k` : 'Data Syncing'}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Active Genesis Nodes</div>
                </div>
              </div>

              <div className="border-t border-[#00CFFF]/10 pt-4 flex items-center justify-between text-xs font-mono text-slate-400">
                <span>EPOCH #{stats.epoch}</span>
                <span className="text-[#00CFFF]">TX: {stats.networkTransactions.toLocaleString()}</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          3. REAL TRUST / PROTOCOL METRICS
         ---------------------------------------------------------------------- */}
      <section className="bg-[#070B14] border-y border-[#00CFFF]/10 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            
            <div className="space-y-1 text-center md:text-left">
              <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Max PHIVO Supply</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                {stats.maxSupply}
              </div>
            </div>

            <div className="space-y-1 text-center md:text-left border-l border-[#00CFFF]/10 pl-0 md:pl-8">
              <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Genesis Node Cap</span>
              <div className="text-xl sm:text-2xl font-extrabold text-white font-mono tracking-tight">
                Fixed maximum of 10,000 Genesis Nodes
              </div>
            </div>

            <div className="space-y-1 text-center md:text-left border-l border-[#00CFFF]/10 pl-0 md:pl-8">
              <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Active Nodes</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#00CFFF] font-mono tracking-tight tabular-nums">
                {stats.activeNodes !== undefined ? stats.activeNodes.toLocaleString() : 'Data Syncing'}
              </div>
            </div>

            <div className="space-y-1 text-center md:text-left border-l border-[#00CFFF]/10 pl-0 md:pl-8">
              <span className="text-xs text-slate-500 font-mono uppercase tracking-wider">Ecosystem Swaps (Rate)</span>
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                ${stats.conversionRate.toFixed(2)} USDT
              </div>
            </div>

          </div>

          {!isConnected && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-amber-500 font-mono">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-ping" />
              Network syncing. Displaying cached snapshots.
            </div>
          )}

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          4. HOW PHIVONEX WORKS
         ---------------------------------------------------------------------- */}
      <section id="ecosystem" className="py-24 sm:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              A Streamlined Path to Decentralized Performance
            </h2>
            <p className="text-slate-400">
              Deploy secure Genesis Nodes without managing complex hardware clusters. Our system abstracts protocol complexity into simple interfaces.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            
            {/* Step 1 */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-4 hover:border-[#00CFFF]/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#00CFFF]/10 flex items-center justify-center text-[#00CFFF]">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs text-slate-500 font-mono">STEP 01</span>
              <h3 className="text-lg font-bold text-white">Create Account</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Register on our secure platform. Instantly obtain unique static BNB & USDT wallet addresses provisioned specifically for you.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-4 hover:border-[#00CFFF]/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#00CFFF]/10 flex items-center justify-center text-[#00CFFF]">
                <Server className="w-5 h-5" />
              </div>
              <span className="text-xs text-slate-500 font-mono">STEP 02</span>
              <h3 className="text-lg font-bold text-white">Activate Genesis Node</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Unlock your node package using your USDT wallet balance. Your unique Genesis identifier is mapped directly to our server-side ledger.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-4 hover:border-[#00CFFF]/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#00CFFF]/10 flex items-center justify-center text-[#00CFFF]">
                <Activity className="w-5 h-5" />
              </div>
              <span className="text-xs text-slate-500 font-mono">STEP 03</span>
              <h3 className="text-lg font-bold text-white">Participate in Network</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Your activated node participates in network validation per epoch. Network activity is logged on our public-facing ledger.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-4 hover:border-[#00CFFF]/30 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-[#00CFFF]/10 flex items-center justify-center text-[#00CFFF]">
                <Coins className="w-5 h-5" />
              </div>
              <span className="text-xs text-slate-500 font-mono">STEP 04</span>
              <h3 className="text-lg font-bold text-white">Manage PHIVO / USDT</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Accrue native PHIVO tokens, swap them instantly inside your secure wallet ledger at administrative rates, and request prompt BEP-20 payouts.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          5. GENESIS NODE SECTION
         ---------------------------------------------------------------------- */}
      <section id="genesis-nodes" className="py-24 sm:py-32 bg-[#070B14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-6 text-left">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              A Fixed Supply of 10,000 Genesis Nodes
            </h2>
            
            <p className="text-slate-300 leading-relaxed">
              We ensure platform integrity by enforcing a fixed maximum of 10,000 Genesis Nodes. Once fully allocated, no additional Genesis Nodes can be activated.
            </p>

            <ul className="space-y-4 text-slate-400 text-sm">
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#00CFFF] shrink-0" />
                <span><strong className="font-bold">Genesis Node Allocation:</strong> Fixed maximum allocation protects network integrity.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#00CFFF] shrink-0" />
                <span><strong className="font-bold">Simple On-Demand Activation:</strong> No complex hardware required. System virtualization and hosting are handled natively server-side.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#00CFFF] shrink-0" />
                <span><strong className="font-bold">Transparent Tracking:</strong> View node activation states, remaining supply, and active operators live.</span>
              </li>
            </ul>

            <div className="pt-2">
              <button 
                onClick={() => onNavigate('/register')}
                className="px-6 py-3 text-xs font-semibold tracking-wide text-white bg-[#0B1528] hover:bg-[#12223F] border border-[#00CFFF]/20 rounded-lg transition-all"
              >
                View Node Allocation Status
              </button>
            </div>
          </div>

          <div className="bg-[#09101C] border border-[#00CFFF]/15 rounded-2xl p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-bold text-white font-mono">GENESIS NODE ALLOCATION</h3>
            
            <div className="space-y-4">
              <div className="flex justify-between border-b border-[#00CFFF]/5 pb-2 text-xs font-mono">
                <span className="text-slate-500">MAXIMUM ALLOCATION</span>
                <span className="text-white font-bold tabular-nums">10,000 Genesis Nodes</span>
              </div>
              <div className="flex justify-between border-b border-[#00CFFF]/5 pb-2 text-xs font-mono">
                <span className="text-slate-500">ACTIVATED NODES</span>
                <span className="text-[#00CFFF] font-bold tabular-nums">{stats.activeNodes ? stats.activeNodes : 'Loading...'}</span>
              </div>
              <div className="flex justify-between border-b border-[#00CFFF]/5 pb-2 text-xs font-mono">
                <span className="text-slate-500">AVAILABLE GENESIS NODES</span>
                <span className="text-white font-bold tabular-nums">
                  {stats.availableNodes ? stats.availableNodes : 'Loading...'}
                </span>
              </div>
              <div className="flex justify-between border-b border-[#00CFFF]/5 pb-2 text-xs font-mono">
                <span className="text-slate-500">NODE PACKAGE PRICE</span>
                <span className="text-white font-bold tabular-nums">$1,000.00 USDT</span>
              </div>
            </div>

            {/* Dynamic Progress indicator */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500 font-mono">
                <span>ALLOCATION FILL RATE</span>
                <span className="tabular-nums">{stats.allocatedPercent.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-[#05070C] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#00CFFF] to-[#4364F7] transition-all duration-1000"
                  style={{ width: `${stats.allocatedPercent}%` }}
                />
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          6. PHIVO SECTION
         ---------------------------------------------------------------------- */}
      <section id="phivo" className="py-24 sm:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            
            <div className="bg-gradient-to-br from-[#09101C] to-[#05070C] border border-[#00CFFF]/10 rounded-2xl p-8 space-y-6 order-last lg:order-first">
              <div className="flex justify-between items-center pb-4 border-b border-[#00CFFF]/5">
                <span className="text-xs font-mono text-slate-500">NATIVE LEDGER CONVERSION</span>
                <span className="text-xs text-[#00CFFF] font-mono">CURRENT CONFIGURED RATE</span>
              </div>

              <div className="space-y-4">
                <div className="text-center py-6 bg-[#05070C]/80 border border-[#00CFFF]/5 rounded-xl space-y-2">
                  <span className="text-xs text-slate-500 font-mono">CONVERSION RATIO</span>
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
                    1.00 PHIVO = ${stats.conversionRate.toFixed(2)} USDT
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono uppercase">Current Configured Rate</span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed text-center">
                  All transactions and balances inside the PHIVONEX ledger are fully integrated with our historical rate integrity. Converts instantly within the system based on the current configured rate. Historical swaps retain the rate recorded at execution.
                </p>
              </div>
            </div>

            <div className="space-y-6 text-left">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                PHIVO: The Foundation of Ecosystem Activity
              </h2>
              <p className="text-slate-300 leading-relaxed">
                PHIVO is the native ecosystem asset powering node validation rewards on the PHIVONEX network. Note that while node rewards are paid in PHIVO, separate referral, matching, and promotional incentives are governed by their own configured financial ledger rules.
              </p>

              <div className="space-y-4 text-sm text-slate-400">
                <div className="flex gap-3">
                  <Coins className="w-5 h-5 text-[#00CFFF] shrink-0" />
                  <span><strong className="font-bold">No Symbolic Alteration:</strong> All assets are consistently referred to as PHIVO. Never PHX or external derivatives.</span>
                </div>
                <div className="flex gap-3">
                  <RefreshCw className="w-5 h-5 text-[#00CFFF] shrink-0" />
                  <span><strong className="font-bold">Instant Conversion:</strong> Swap earned PHIVO directly to standard USDT inside the secure dashboard instantly.</span>
                </div>
              </div>
            </div>

          </div>

          {/* On-Chain Verification Block */}
          <div className="mt-12 bg-gradient-to-r from-[#09101E] to-[#05070D] border border-[#00CFFF]/15 rounded-2xl p-6 sm:p-8 relative overflow-hidden text-left">
            {/* Background glowing gradient accents */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00CFFF]/5 rounded-full blur-3xl pointer-events-none" />
            
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
                
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  The PHIVO token rules, fixed supply limits, and economic balance allocations are permanently recorded and hardcoded on the <strong>BNB Smart Chain (BEP-20)</strong>. This ledger state is publicly readable, verified, and audited.
                </p>

                {/* Contract address display row */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Authoritative Contract Address</span>
                    <span className="font-mono text-xs sm:text-sm text-[#00CFFF] bg-[#05070C] px-3 py-2 rounded-lg border border-[#00CFFF]/10 break-all select-all font-semibold">
                      {PHIVONEX_TOKEN_CONFIG.contractAddress}
                    </span>
                  </div>

                  <button
                    onClick={copyContractAddress}
                    className="sm:self-end px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] flex items-center justify-center gap-2 text-xs font-medium tracking-wide transition-all cursor-pointer whitespace-nowrap active:scale-[0.98]"
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

              {/* Action Column */}
              <div className="flex flex-col justify-center shrink-0 gap-3">
                <a
                  href={`https://bscscan.com/address/${PHIVONEX_TOKEN_CONFIG.contractAddress}#code`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-3 rounded-lg bg-gradient-to-r from-[#00CFFF]/20 to-[#168BFF]/20 hover:from-[#00CFFF]/30 hover:to-[#168BFF]/30 text-[#00CFFF] border border-[#00CFFF]/30 hover:border-[#00CFFF]/50 flex items-center justify-center gap-2 text-xs font-bold tracking-wide transition-all shadow-[0_0_15px_rgba(0,207,255,0.05)] animate-pulse"
                  style={{ animationDuration: '4s' }}
                >
                  <span>View on BscScan</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                {/* Neutral Disclaimer */}
                <span className="text-[9px] text-slate-500 max-w-[280px] leading-relaxed block text-center md:text-left">
                  * Public contract registry verification only. BscScan is an independent, third-party block explorer. This lookup is for audit transparency and does not imply BscScan endorsement, investment approval, or financial guarantee.
                </span>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          7. NETWORK / TRANSPARENCY SECTION
         ---------------------------------------------------------------------- */}
      <section id="network" className="py-24 sm:py-32 bg-[#070B14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Public Network & Ledger Transparency
            </h2>
            <p className="text-slate-400">
              PHIVONEX provides public network & ledger transparency. Access node activity, ledger status, and reward epochs.
            </p>
          </div>

          {/* Real-time Ledger Feed */}
          <div className="bg-[#09101C] border border-[#00CFFF]/15 rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-6 bg-[#0B1528] border-b border-[#00CFFF]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#00CFFF]" />
                <h3 className="font-bold text-white font-mono text-sm uppercase tracking-wider">Public Network Activity</h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                CONNECTED STATE · TIMESTAMPS DETERMINISTIC
              </span>
            </div>

            <div className="divide-y divide-[#00CFFF]/10">
              {events && events.length > 0 ? (
                events.slice(0, 5).map((evt: any) => (
                  <div key={evt.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#0C1929] transition-colors">
                    <div className="space-y-1 text-left">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white font-sans">
                        <span className="w-1.5 h-1.5 bg-[#00CFFF] rounded-full" />
                        {evt.title}
                      </div>
                      <p className="text-xs text-slate-400 max-w-2xl">{evt.details}</p>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-mono text-slate-500 shrink-0 self-end sm:self-center">
                      <span>BLOCK #{evt.blockNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeTime(evt.timestamp)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 font-mono">
                  No public telemetry blocks registered yet.
                </div>
              )}
            </div>

            <div className="p-4 bg-[#0B1528] border-t border-[#00CFFF]/10 text-center">
              <button 
                onClick={() => onNavigate('/network')}
                className="text-xs font-semibold text-[#00CFFF] hover:underline flex items-center justify-center gap-1 mx-auto"
              >
                Access Public Network Ledger
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          8. ECOSYSTEM FEATURES
         ---------------------------------------------------------------------- */}
      <section className="py-24 sm:py-32 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Comprehensive Feature-Set Engineered for Security
            </h2>
            <p className="text-slate-400">
              Ten modular building blocks coordinating to provide an unmatched, enterprise-grade validation infrastructure.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            
            {/* 1. Genesis Nodes */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-3 hover:border-[#00CFFF]/30 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase">01. Genesis Nodes</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Allocate limited virtual computing verification keys hard-capped globally to 10,000 units.
              </p>
            </div>

            {/* 2. Referral Network */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-3 hover:border-[#00CFFF]/30 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase">02. Referral Network</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect and expand our ecosystem with secure genealogy structures, paying a $50 direct referral commission per eligible activated node.
              </p>
            </div>

            {/* 3. Binary Matching */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-3 hover:border-[#00CFFF]/30 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase">03. Binary Matching</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Participate in dynamically configured matching tiers (qualification required). Payouts are calculated daily using the highest eligible daily tier only, with a maximum daily matching payout of $5,000, subject to configured business rules.
              </p>
            </div>

            {/* 4. PHIVO Rewards */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-3 hover:border-[#00CFFF]/30 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase">04. PHIVO Rewards</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Validation rewards issued per epoch directly to active node balances based on configured reward epochs.
              </p>
            </div>

            {/* 5. USDT Wallet */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-3 hover:border-[#00CFFF]/30 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase">05. USDT Wallet</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Deposit and request BEP-20 standard USDT transactions with instant transaction mapping.
              </p>
            </div>

            {/* 6. Internal Swap */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-3 hover:border-[#00CFFF]/30 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase">06. Internal Swap</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Convert PHIVO rewards directly to stable USDT inside the wallet ledger at admin-configured ratios.
              </p>
            </div>

            {/* 7. Notifications */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-3 hover:border-[#00CFFF]/30 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase">07. Notifications</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Receive real-time on-screen and automated email notifications for logins, deposits, and rewards.
              </p>
            </div>

            {/* 8. Transparent Ledger */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-3 hover:border-[#00CFFF]/30 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase">08. Transparent Ledger</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                A public network logging system that records transaction logs, reward state, and epoch events.
              </p>
            </div>

            {/* 9. Security */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-3 hover:border-[#00CFFF]/30 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase">09. Security</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Server-side authorization walls protecting client environments from sensitive credential exposure.
              </p>
            </div>

            {/* 10. Reconciliation */}
            <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-3 hover:border-[#00CFFF]/30 transition-all">
              <div className="text-[#00CFFF] font-bold text-xs font-mono uppercase">10. Reconciliation</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                System checks audit the entire state machine continuously for financial balance.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          9. SECURITY SECTION
         ---------------------------------------------------------------------- */}
      <section id="security" className="py-24 sm:py-32 bg-[#070B14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          <div className="space-y-6 text-left">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Shield className="w-8 h-8 text-[#00CFFF] shrink-0" />
              Advanced Security Protocol Walls
            </h2>
            <p className="text-slate-300 leading-relaxed">
              We operate on a secure client-server model. Every financial ledger update, commission calculation, and swap operation must execute exclusively inside isolated server-side frameworks.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 text-slate-400 text-sm">
              <div className="space-y-1">
                <span className="text-[#00CFFF] font-mono text-xs uppercase font-bold">Server-Side Authorization</span>
                <p className="text-xs">Frontend controls never submit balance changes. Every transaction requires authoritative server checks.</p>
              </div>
              <div className="space-y-1">
                <span className="text-[#00CFFF] font-mono text-xs uppercase font-bold">Transaction Idempotency</span>
                <p className="text-xs">Database transactions are protected with secure unique keys to prevent double-spending.</p>
              </div>
              <div className="space-y-1">
                <span className="text-[#00CFFF] font-mono text-xs uppercase font-bold">Reconciliation Scans</span>
                <p className="text-xs">Continuous balance integrity checks automatically flagging any ledger variance instantly.</p>
              </div>
              <div className="space-y-1">
                <span className="text-[#00CFFF] font-mono text-xs uppercase font-bold">Protected Secrets</span>
                <p className="text-xs">Cryptographic API keys and seeds are strictly isolated and never exposed to standard browser memory.</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-[#09101C] to-[#05070C] border border-[#00CFFF]/15 rounded-2xl p-6 sm:p-8 space-y-6 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs text-[#00CFFF] font-mono">
              <Lock className="w-4 h-4" />
              <span>CRYPTOGRAPHIC LEDGER INTEGRITY</span>
            </div>

            <div className="bg-[#05070C]/90 border border-[#00CFFF]/5 rounded-xl p-4 space-y-2 font-mono text-xs">
              <div className="text-slate-500">LEDGER STATE AUDIT:</div>
              <div className="text-emerald-500 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                VERIFIED CONSTANT INTEGRITY
              </div>
              <div className="text-slate-400 pt-2 text-[10px] leading-relaxed">
                System state machines scan for ledger variances. Security parameters verified systematically.
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed font-mono">
              SYSTEM: PHIVONEX SECURE CORE v1.0.1 // SERVER-VALIDATED LEDGER SYSTEM
            </p>
          </div>

        </div>
      </section>

      {/* ----------------------------------------------------------------------
          10. RESPONSIBLE DISCLOSURE (Disclaimers)
         ---------------------------------------------------------------------- */}
      <section className="py-16 bg-[#05070C] border-t border-[#00CFFF]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl p-6 space-y-4 max-w-4xl mx-auto">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-300 font-mono">
              Responsible Disclosure & Risk Advisory
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Decentralized infrastructure models and nodes networks present various technological risks. Uptime performance, rewards allocation cycles, and swap rates are subject strictly to rules configured and verified by our system administration team. All rewards accrued within the PHIVONEX ecosystem are contingent on qualifying validator operations, deterministic network requirements, and active compliance guidelines. We make no guarantees of consistent profitability, specific income returns, or permanent pricing liquidity. Asset value fluctuations on the blockchain can carry significant inherent risk. Ensure you thoroughly review applicable terms of service and risk policies prior to activating node packages.
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------------
          11. FAQ SECTION
         ---------------------------------------------------------------------- */}
      <section id="faq" className="py-24 sm:py-32 bg-[#070B14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-slate-400">
              Have questions? Find concise, authoritative explanations on node hosting and the validation mechanics.
            </p>
          </div>

          <div className="space-y-4">
            {faqItems.map((item, idx) => (
              <div 
                key={idx} 
                className="bg-[#09101C] border border-[#00CFFF]/10 rounded-xl overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left text-sm sm:text-base font-bold text-white hover:bg-[#0C1929] transition-colors focus:outline-none"
                >
                  <span>{item.q}</span>
                  {openFaq === idx ? (
                    <ChevronUp className="w-5 h-5 text-[#00CFFF] shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-[#00CFFF] shrink-0" />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-5 pt-1 border-t border-[#00CFFF]/5 text-xs sm:text-sm text-slate-400 leading-relaxed">
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
      <footer className="bg-[#05070C] border-t border-[#00CFFF]/10 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          
          <div className="space-y-4 col-span-2 md:col-span-1 text-left">
            <div className="flex items-center gap-2">
              <PhivonexSymbol size={22} animated={false} glow={false} />
              <span className="text-lg font-extrabold tracking-wider text-white font-mono">
                PHIVONEX
              </span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Premium, high-performance node infrastructure and decentralized ledger transparency systems for Web3 validation audits.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Ecosystem</h4>
            <div className="flex flex-col gap-2 text-xs text-slate-500">
              <button onClick={() => scrollToSection('hero')} className="hover:text-[#00CFFF] text-left transition-colors">Home</button>
              <button onClick={() => scrollToSection('ecosystem')} className="hover:text-[#00CFFF] text-left transition-colors">Ecosystem</button>
              <button onClick={() => scrollToSection('genesis-nodes')} className="hover:text-[#00CFFF] text-left transition-colors">Genesis Nodes</button>
            </div>
          </div>

          <div className="space-y-3 text-left">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Security</h4>
            <div className="flex flex-col gap-2 text-xs text-slate-500">
              <button onClick={() => scrollToSection('security')} className="hover:text-[#00CFFF] text-left transition-colors">Integrity Protocol</button>
              <button onClick={() => scrollToSection('faq')} className="hover:text-[#00CFFF] text-left transition-colors">FAQ Support</button>
              <button onClick={() => onNavigate('/network')} className="hover:text-[#00CFFF] text-left transition-colors">Telemetry Ledger</button>
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
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Legal & Risk</h4>
            <div className="flex flex-col gap-2 text-xs text-slate-500">
              <button onClick={() => onNavigate('/register')} className="hover:text-[#00CFFF] text-left transition-colors">Terms of Service</button>
              <button onClick={() => onNavigate('/login')} className="hover:text-[#00CFFF] text-left transition-colors">Privacy Policy</button>
              <button onClick={() => scrollToSection('faq')} className="hover:text-[#00CFFF] text-left transition-colors">Risk Disclosures</button>
            </div>
          </div>

        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-[#00CFFF]/5 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500 font-mono">
          <span>&copy; {new Date().getFullYear()} PHIVONEX. All Rights Reserved.</span>
          <span>Security Audit Verified</span>
        </div>
      </footer>

    </div>
  );
};
