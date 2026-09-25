/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { NetworkMetricBar } from './components/NetworkMetricBar';
import { Introduction } from './components/Introduction';
import { PrinciplesGrid } from './components/PrinciplesGrid';
import { CoinSupplySection } from './components/CoinSupplySection';
import { NodeNetworkSection } from './components/NodeNetworkSection';
import { NodeSupplyVisualization } from './components/NodeSupplyVisualization';
import { NodeRewardConcept } from './components/NodeRewardConcept';
import { LiveNetworkSection } from './components/LiveNetworkSection';
import { SecurityTransparencySection } from './components/SecurityTransparencySection';
import { Roadmap } from './components/Roadmap';
import { FAQ } from './components/FAQ';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';

// Pages
import { RegisterPage } from './pages/RegisterPage';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { NetworkPublicPage } from './pages/NetworkPublicPage';
import { AdminPage } from './pages/AdminPage';

// Modals
import { LedgerReceiptModal } from './components/modals/LedgerReceiptModal';
import { LaunchAppModal } from './components/modals/LaunchAppModal';
import { LegalModal } from './components/modals/LegalModal';

import { INITIAL_NETWORK_SUMMARY } from './data/networkData';
import { LedgerEvent } from './types/network';
import { usePublicNetwork } from './hooks/usePublicNetwork';

function AppContent() {
  const { user, loading } = useAuth();
  const publicNet = usePublicNetwork();

  const [currentPath, setCurrentPath] = useState<string>(() => {
    try {
      return window.location.pathname || '/';
    } catch {
      return '/';
    }
  });

  const [inspectedEvent, setInspectedEvent] = useState<LedgerEvent | null>(null);
  const [isLaunchAppOpen, setIsLaunchAppOpen] = useState(false);
  const [legalModalTitle, setLegalModalTitle] = useState<string | null>(null);

  // Synchronize history state for routing
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (to: string) => {
    try {
      window.history.pushState({}, '', to);
      const url = new URL(to, window.location.origin);
      setCurrentPath(url.pathname);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setCurrentPath(to);
    }
  };

  const scrollToSection = (id: string) => {
    if (currentPath !== '/') {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleInspectNode = (nodeInfo: { id: string; role: string; latency: string }) => {
    setInspectedEvent({
      id: `evt-inspect-${nodeInfo.id.slice(-4)}`,
      type: 'node_activated',
      title: `Node ${nodeInfo.id} Telemetry Verified`,
      txHash: '0x8f2d6541a7c38e920d512a819b4cf177263b6528df5289a071f5442654bc6589',
      nodeId: nodeInfo.id,
      blockNumber: 42188941,
      timestamp: 'Active Real-Time',
      status: 'finalized',
      details: `Validator node operating with ${nodeInfo.role} consensus responsibilities at ${nodeInfo.latency} roundtrip latency.`,
    });
  };

  const handleInspectEvent = (evt: { title: string; type: string; details: string }) => {
    let mappedType: LedgerEvent['type'] = 'ledger_checkpoint';
    if (evt.type.toLowerCase().includes('activate')) mappedType = 'node_activated';
    else if (evt.type.toLowerCase().includes('epoch')) mappedType = 'reward_epoch_completed';
    else if (evt.type.toLowerCase().includes('ownership')) mappedType = 'ownership_updated';
    else if (evt.type.toLowerCase().includes('claim')) mappedType = 'reward_claim_confirmed';

    setInspectedEvent({
      id: `evt-${Date.now().toString().slice(-6)}`,
      type: mappedType,
      title: `${evt.title} Event Confirmed`,
      txHash: '0x3c9f2148a071f5442654bc65898f2d6541a7c38e920d512a819b4cf177263b65',
      nodeId: 'PX-00042',
      blockNumber: 42188992,
      timestamp: 'Just now',
      status: 'finalized',
      details: evt.details,
    });
  };

  // ROUTE: /network (Public Network & Telemetry Page)
  if (currentPath === '/network' || currentPath.startsWith('/network/')) {
    return <NetworkPublicPage onNavigate={navigate} />;
  }

  // ROUTE: /app (Authenticated Protocol Dashboard)
  if (currentPath === '/app' || currentPath.startsWith('/app/')) {
    if (!loading && !user) {
      return <LoginPage onNavigate={navigate} />;
    }
    return <DashboardPage onNavigate={navigate} currentPath={currentPath} />;
  }

  // ROUTE: /withdrawals (Alias for /app/withdrawals)
  if (currentPath === '/withdrawals' || currentPath.startsWith('/withdrawals/')) {
    if (!loading && !user) {
      return <LoginPage onNavigate={navigate} />;
    }
    return <DashboardPage onNavigate={navigate} currentPath="/app/withdrawals" />;
  }

  // ROUTE: /deposit (Alias for /app/deposit)
  if (currentPath === '/deposit' || currentPath.startsWith('/deposit/')) {
    if (!loading && !user) {
      return <LoginPage onNavigate={navigate} />;
    }
    return <DashboardPage onNavigate={navigate} currentPath="/app/deposit" />;
  }

  // ROUTE: /admin (Protected Admin Control Plane)
  if (currentPath === '/admin' || currentPath.startsWith('/admin/')) {
    if (!loading && !user) {
      return <LoginPage onNavigate={navigate} />;
    }
    return <AdminPage onNavigate={navigate} currentPath={currentPath} />;
  }

  // ROUTE: /register
  if (currentPath === '/register' || currentPath.startsWith('/register/')) {
    if (!loading && user) {
      return <DashboardPage onNavigate={navigate} currentPath="/app" />;
    }
    return (
      <>
        <RegisterPage
          onNavigate={navigate}
          onOpenLegalModal={(title) => setLegalModalTitle(title)}
        />
        <LegalModal
          title={legalModalTitle}
          onClose={() => setLegalModalTitle(null)}
        />
      </>
    );
  }

  // ROUTE: /login
  if (currentPath === '/login' || currentPath.startsWith('/login/')) {
    if (!loading && user) {
      return <DashboardPage onNavigate={navigate} currentPath="/app" />;
    }
    return (
      <LoginPage
        onNavigate={navigate}
      />
    );
  }

  // Derived real landing page summary
  const landingSummary = {
    ...INITIAL_NETWORK_SUMMARY,
    genesisNodeCap: publicNet.summary.genesisNodeCap || 10000,
    activeNodes: publicNet.summary.activeNodes,
    allocatedNodes: publicNet.summary.activeNodes + publicNet.summary.reservedNodes,
    availableNodes: publicNet.summary.availableNodes,
    allocationPercent: publicNet.summary.allocationPercent,
    currentRewardEpoch: publicNet.summary.currentRewardEpoch,
    networkTransactions: publicNet.summary.totalNetworkTransactions,
    networkStatus: publicNet.summary.networkStatus.toLowerCase() as any,
    updatedAt: publicNet.summary.updatedAt,
  };

  // DEFAULT ROUTE: Public Landing Page
  return (
    <div className="min-h-screen bg-[#05070B] text-[#F7FAFC] font-sans selection:bg-[#00CFFF]/20 selection:text-[#00CFFF]">
      
      {/* 1. NAVBAR */}
      <Navbar
        onExploreClick={() => navigate('/network')}
        onLaunchAppClick={() => navigate(user ? '/app' : '/login')}
      />

      <main>
        {/* 2. HERO SECTION */}
        <Hero
          onExploreClick={() => scrollToSection('ecosystem')}
          onViewLiveNetwork={() => navigate('/network')}
          onInspectNode={handleInspectNode}
        />

        {/* 3. KEY NETWORK METRICS */}
        <NetworkMetricBar
          metrics={landingSummary}
          onViewLedger={() => navigate('/network')}
          isApiConnected={publicNet.isConnected}
        />

        {/* 4. WHAT IS PHIVONEX */}
        <Introduction />

        {/* 5. CORE PRINCIPLES */}
        <PrinciplesGrid />

        {/* 6. PHIVONEX COIN */}
        <CoinSupplySection />

        {/* 7. GENESIS NODE NETWORK */}
        <NodeNetworkSection />

        {/* 8. NODE SUPPLY VISUALIZATION */}
        <NodeSupplyVisualization
          summary={landingSummary}
          isLiveApiConnected={publicNet.isConnected}
        />

        {/* 9. NODE REWARD / MINING CONCEPT */}
        <NodeRewardConcept />

        {/* 10. LIVE NETWORK / LEDGER */}
        <LiveNetworkSection
          liveEvents={publicNet.events}
          onInspectEvent={handleInspectEvent}
        />

        {/* 11. SECURITY & TRANSPARENCY */}
        <SecurityTransparencySection
          onOpenWhitepaper={() => setLegalModalTitle('Technical Whitepaper')}
          onExploreExplorer={() => navigate('/network')}
        />

        {/* 12. ROADMAP */}
        <Roadmap />

        {/* 13. FAQ */}
        <FAQ />

        {/* 14. FINAL CTA */}
        <FinalCTA
          onLaunchApp={() => navigate(user ? '/app' : '/register')}
          onExploreNetwork={() => navigate('/network')}
          onReadDocs={() => setLegalModalTitle('Technical Whitepaper')}
        />
      </main>

      {/* 15. FOOTER */}
      <Footer
        onOpenLegal={(title) => setLegalModalTitle(title)}
        onExploreClick={() => navigate('/network')}
      />

      {/* Interactive Modals */}
      <LedgerReceiptModal
        event={inspectedEvent}
        onClose={() => setInspectedEvent(null)}
      />

      <LaunchAppModal
        isOpen={isLaunchAppOpen}
        onClose={() => setIsLaunchAppOpen(false)}
      />

      <LegalModal
        title={legalModalTitle}
        onClose={() => setLegalModalTitle(null)}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
