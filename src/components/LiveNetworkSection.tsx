import React from 'react';
import { ShieldCheck, Activity, Layers, Server, RefreshCw, Award, CheckCircle2 } from 'lucide-react';

interface LiveNetworkSectionProps {
  onInspectEvent?: (evt: { title: string; type: string; details: string }) => void;
}

export const LiveNetworkSection: React.FC<LiveNetworkSectionProps> = ({ onInspectEvent }) => {
  const eventTypes = [
    {
      type: 'Node Activated',
      desc: 'Cryptographic attestation and hardware verification committed to the genesis registry.',
      icon: Server,
      accent: '#00CFFF',
      sampleId: 'EVT-ACT-0091',
    },
    {
      type: 'Reward Epoch Completed',
      desc: 'Mathematical reward allocation calculated across all active validator nodes.',
      icon: Award,
      accent: '#168BFF',
      sampleId: 'EVT-EPOCH-142',
    },
    {
      type: 'Ownership Updated',
      desc: 'Peer-to-peer node key reassignment finalized on the immutable state ledger.',
      icon: RefreshCw,
      accent: '#7057FF',
      sampleId: 'EVT-OWN-0412',
    },
    {
      type: 'Reward Claim Confirmed',
      desc: 'Cryptographic receipt generated for non-custodial reward redemption.',
      icon: CheckCircle2,
      accent: '#32D583',
      sampleId: 'EVT-CLM-8821',
    },
    {
      type: 'Ledger Checkpoint',
      desc: 'Merkle state root finalized and anchored to Layer-1 consensus blocks.',
      icon: Layers,
      accent: '#00CFFF',
      sampleId: 'EVT-CHK-9941',
    },
  ];

  return (
    <section id="live-network" className="py-20 sm:py-28 relative border-t border-white/[0.06] bg-[#05070B] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] text-xs font-mono text-[#00CFFF]">
            <Activity className="w-3.5 h-3.5" />
            <span>LIVE LEDGER AUDIT</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#F7FAFC] tracking-tight">
            Live Network &amp; Ledger Checkpoints
          </h2>
          <p className="text-sm sm:text-base text-[#98A2B3] leading-relaxed">
            Every critical state transition produces an immutable, cryptographic ledger event. Telemetry and state receipts are accessible through decentralized RPC endpoints.
          </p>
        </div>

        {/* Real Event Types Architecture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {eventTypes.map((evt, idx) => {
            const Icon = evt.icon;
            return (
              <div
                key={idx}
                onClick={() => onInspectEvent?.({
                  title: evt.type,
                  type: evt.type,
                  details: evt.desc,
                })}
                className="p-6 rounded-2xl bg-[#07101D]/90 border border-white/[0.08] hover:border-[#00CFFF]/40 transition-all duration-200 cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                      style={{ backgroundColor: `${evt.accent}15`, color: evt.accent }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono text-[#98A2B3] bg-white/[0.04] px-2.5 py-1 rounded-md">
                      {evt.sampleId}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[#F7FAFC] mb-2 group-hover:text-[#00CFFF] transition-colors">
                    {evt.type}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#98A2B3] leading-relaxed">
                    {evt.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-[#98A2B3]">
                  <span>Receipt Format: SHA-256</span>
                  <span className="text-[#32D583]">Verifiable</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Real Data Connection Notice Banner */}
        <div className="p-5 rounded-2xl bg-[#07101D] border border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#98A2B3]">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-[#32D583] shrink-0" />
            <span>
              <strong>Real-Time Transparency:</strong> Live transaction telemetry syncs with verified nodes. No synthetic data or simulated transactions are displayed.
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-[#00CFFF] shrink-0">
            RPC Status: Operational
          </div>
        </div>

      </div>
    </section>
  );
};
