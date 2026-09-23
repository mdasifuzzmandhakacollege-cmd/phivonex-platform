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

// Modals
import { LedgerReceiptModal } from './components/modals/LedgerReceiptModal';
import { LaunchAppModal } from './components/modals/LaunchAppModal';
import { LegalModal } from './components/modals/LegalModal';

import { INITIAL_NETWORK_SUMMARY } from './data/networkData';
import { LedgerEvent } from './types/network';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    try {
      return window.location.pathname || '/';
    } catch {
      return '/';
    }
  });

  const [networkSummary, setNetworkSummary] = useState(INITIAL_NETWORK_SUMMARY);
  const [inspectedEvent, setInspectedEvent] = useState<LedgerEvent | null>(null);
  const [isLaunchAppOpen, setIsLaunchAppOpen] = useState(false);
  const [legalModalTitle, setLegalModalTitle] = useState<string | null>(null);

  // Connect landing page stats to real /api/nodes/stats endpoint
  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/nodes/stats');
        if (res.ok) {
          const stats = await res.json();
          if (isMounted && stats) {
            setNetworkSummary((prev) => ({
              ...prev,
              genesisNodeCap: stats.genesisCap ?? 10000,
              availableNodes: stats.available ?? 10000,
              allocatedNodes: stats.allocated ?? 0,
              activeNodes: stats.active ?? 0,
              allocationPercent: stats.genesisCap > 0 ? (stats.allocated / stats.genesisCap) * 100 : 0,
              nodesUntilNextStage: stats.available ?? 10000,
            }));
          }
        }
      } catch (err) {
        console.warn('Could not fetch node stats for landing metrics:', err);
      }
    };
    fetchStats();
    return () => {
      isMounted = false;
    };
  }, []);

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

  // ROUTE: /app (Authenticated Protocol Dashboard)
  if (currentPath === '/app' || currentPath.startsWith('/app/')) {
    if (!loading && !user) {
      // Redirect to login if not authenticated
      return <LoginPage onNavigate={navigate} />;
    }
    return <DashboardPage onNavigate={navigate} currentPath={currentPath} />;
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

  // DEFAULT ROUTE: Public Landing Page
  return (
    <div className="min-h-screen bg-[#05070B] text-[#F7FAFC] font-sans selection:bg-[#00CFFF]/20 selection:text-[#00CFFF]">
      
      {/* 1. NAVBAR */}
      <Navbar
        onExploreClick={() => scrollToSection('live-network')}
        onLaunchAppClick={() => navigate(user ? '/app' : '/login')}
      />

      <main>
        {/* 2. HERO SECTION */}
        <Hero
          onExploreClick={() => scrollToSection('ecosystem')}
          onViewLiveNetwork={() => scrollToSection('live-network')}
          onInspectNode={handleInspectNode}
        />

        {/* 3. KEY NETWORK METRICS */}
        <NetworkMetricBar
          metrics={networkSummary}
          onViewLedger={() => scrollToSection('live-network')}
          isApiConnected={false}
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
          summary={networkSummary}
          isLiveApiConnected={false}
        />

        {/* 9. NODE REWARD / MINING CONCEPT */}
        <NodeRewardConcept />

        {/* 10. LIVE NETWORK / LEDGER */}
        <LiveNetworkSection
          onInspectEvent={handleInspectEvent}
        />

        {/* 11. SECURITY & TRANSPARENCY */}
        <SecurityTransparencySection
          onOpenWhitepaper={() => setLegalModalTitle('Technical Whitepaper')}
          onExploreExplorer={() => scrollToSection('live-network')}
        />

        {/* 12. ROADMAP */}
        <Roadmap />

        {/* 13. FAQ */}
        <FAQ />

        {/* 14. FINAL CTA */}
        <FinalCTA
          onLaunchApp={() => navigate(user ? '/app' : '/register')}
          onExploreNetwork={() => scrollToSection('live-network')}
          onReadDocs={() => setLegalModalTitle('Technical Whitepaper')}
        />
      </main>

      {/* 15. FOOTER */}
      <Footer
        onOpenLegal={(title) => setLegalModalTitle(title)}
        onExploreClick={() => scrollToSection('live-network')}
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
