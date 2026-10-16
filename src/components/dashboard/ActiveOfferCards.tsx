import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Gift,
  ArrowRight,
  Zap,
  Coins,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ChevronRight,
  Layers,
} from 'lucide-react';

export interface PromotionalOffer {
  id: string;
  title: string;
  description: string;
  bannerImage?: string;
  offerType: 'BOGO_FREE_NODE' | 'FREE_BONUS_NODE' | 'DISCOUNT' | 'CUSTOM' | string;
  bonusNodesCount: number;
  bonusMiningRewards: boolean;
  bonusMatchingEnabled: boolean;
  bonusReferralCommission: boolean;
  startDate?: string;
  endDate?: string;
  status: 'ACTIVE' | 'INACTIVE';
  targetAudience?: 'ALL' | 'NEW' | 'VIP';
  priorityOrder?: number;
}

interface ActiveOfferCardsProps {
  onNavigateTab?: (tab: string) => void;
  variant?: 'compact' | 'full' | 'hero';
}

export const ActiveOfferCards: React.FC<ActiveOfferCardsProps> = ({
  onNavigateTab,
  variant = 'full',
}) => {
  const [offers, setOffers] = useState<PromotionalOffer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchActiveOffers = useCallback(async () => {
    try {
      const res = await fetch('/api/promotions/offers', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.offers)) {
          setOffers(data.offers.filter((o: PromotionalOffer) => o.status === 'ACTIVE'));
        }
      }
    } catch (err) {
      console.warn('[ActiveOfferCards] Failed to fetch active promotional offers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveOffers();

    const handleUpdate = () => {
      fetchActiveOffers();
    };

    window.addEventListener('phivonex:offers-updated', handleUpdate);
    return () => window.removeEventListener('phivonex:offers-updated', handleUpdate);
  }, [fetchActiveOffers]);

  if (loading || offers.length === 0) {
    return null;
  }

  const handleClaim = (offer: PromotionalOffer) => {
    if (onNavigateTab) {
      if (offer.offerType === 'DISCOUNT' || offer.offerType === 'BOGO_FREE_NODE' || offer.offerType === 'FREE_BONUS_NODE') {
        onNavigateTab('nodes/buy');
      } else {
        onNavigateTab('nodes/buy');
      }
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-500/20 to-indigo-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Gift className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Exclusive Protocol Offers &amp; BOGO Deals</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#32D583]/10 text-[#32D583] border border-[#32D583]/30">
                ACTIVE NOW
              </span>
            </h3>
            <p className="text-[11px] text-[#98A2B3]">
              Special promotional rewards administered directly by PHIVONEX Governance
            </p>
          </div>
        </div>

        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('nodes/buy')}
            className="text-xs font-semibold text-[#00CFFF] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View All in Node Store</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className={`grid gap-4 ${offers.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {offers.map((offer) => {
          const isBogo = offer.offerType === 'BOGO_FREE_NODE' || offer.offerType === 'FREE_BONUS_NODE';
          
          return (
            <div
              key={offer.id}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B1527] via-[#07101D] to-[#120B24] border border-purple-500/30 hover:border-purple-400/60 p-5 sm:p-6 shadow-xl transition-all duration-300 flex flex-col justify-between group"
            >
              {/* Subtle background glow */}
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none group-hover:bg-purple-600/15 transition-all" />

              <div className="relative z-10 space-y-3">
                {/* Header Tag / Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>{isBogo ? 'BOGO PROMO REWARD' : 'OFFICIAL NETWORK OFFER'}</span>
                  </span>

                  {offer.bonusNodesCount > 0 && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-[#32D583]/15 text-[#32D583] border border-[#32D583]/30 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 fill-[#32D583]" />
                      <span>+{offer.bonusNodesCount} FREE PROMO NODE</span>
                    </span>
                  )}
                </div>

                {/* Offer Title & Description */}
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-white group-hover:text-purple-200 transition-colors">
                    {offer.title}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {offer.description}
                  </p>
                </div>

                {/* Value Props / Benefit Badges */}
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div className="p-2.5 rounded-xl bg-[#05070B]/80 border border-white/[0.06] flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <span className="text-[#98A2B3] text-[9px] block uppercase">Mining Rewards</span>
                      <span className="text-white font-bold">
                        {offer.bonusMiningRewards ? 'Active (Full PHIVO)' : 'Standard'}
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#05070B]/80 border border-white/[0.06] flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#00CFFF] shrink-0" />
                    <div>
                      <span className="text-[#98A2B3] text-[9px] block uppercase">Consensus Status</span>
                      <span className="text-[#00CFFF] font-bold">100% Eligible</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="relative z-10 pt-4 mt-2 border-t border-white/[0.08] flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-[11px] text-[#98A2B3] font-mono">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#32D583]" />
                  <span>Auto-applied upon activation</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleClaim(offer)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-[#00CFFF] hover:brightness-110 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-purple-500/25 shrink-0 min-h-[38px]"
                >
                  <span>Claim Offer Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
