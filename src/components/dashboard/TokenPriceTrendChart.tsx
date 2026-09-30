import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react';
import { PhivoCoinIcon } from '../brand/CryptoIcons';

export interface TokenPricePoint {
  timestamp: string;
  timeLabel: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeUsd?: number;
  change: number;
  changePercent?: number;
}

export interface TokenPriceTrendData {
  tokenSymbol: string;
  tokenName: string;
  currentPrice: number;
  open24h: number;
  high24h: number;
  low24h: number;
  change24h: number;
  change24hPercent: number;
  volume24h: number;
  marketCap?: number;
  circulatingSupply?: number;
  timeframe: string;
  updatedAt: string;
  points: TokenPricePoint[];
}

interface TokenPriceTrendChartProps {
  onNavigateTab?: (tab: string) => void;
  className?: string;
  compact?: boolean;
}

export const TokenPriceTrendChart: React.FC<TokenPriceTrendChartProps> = ({
  onNavigateTab,
  className = '',
  compact = false,
}) => {
  const [timeframe, setTimeframe] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [data, setData] = useState<TokenPriceTrendData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [hoveredPoint, setHoveredPoint] = useState<TokenPricePoint | null>(null);

  // Fetch trend data
  const fetchPriceTrend = useCallback(async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setLoading(true);
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/public/network/price-trend?timeframe=${timeframe}`);
      if (res.ok) {
        const trendData: TokenPriceTrendData = await res.json();
        setData(trendData);
      }
    } catch (err) {
      console.warn('[TokenPriceTrendChart] Error loading price data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchPriceTrend(true);
    // Real-time polling interval
    const interval = setInterval(() => {
      fetchPriceTrend(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchPriceTrend]);

  // Active prices & derived stats - strictly authoritative
  const currentPrice = data?.currentPrice ?? 0.1;
  const activePrice = hoveredPoint?.price ?? currentPrice;
  const change24h = data?.change24h ?? 0;
  const change24hPercent = data?.change24hPercent ?? 0;

  // Calculate dynamic domain with safe bounds
  const { minVal, maxVal } = useMemo(() => {
    if (!data || !data.points.length) {
      const base = currentPrice || 0.1;
      return { minVal: Math.max(0, base * 0.9), maxVal: base * 1.1 };
    }
    const values = data.points.map((p) => p.price);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
      return {
        minVal: Math.max(0, Number((min * 0.95).toFixed(4))),
        maxVal: Number((max * 1.05).toFixed(4)),
      };
    }
    const padding = (max - min) * 0.15;
    return {
      minVal: Math.max(0, Number((min - padding).toFixed(4))),
      maxVal: Number((max + padding).toFixed(4)),
    };
  }, [data, currentPrice]);

  // Custom hover tooltip displaying precise authoritative data
  const CustomOhlcTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point: TokenPricePoint = payload[0].payload;
      return (
        <div className="rounded-xl bg-[#05070B]/95 border border-white/[0.12] p-3 shadow-2xl backdrop-blur-md text-xs font-mono space-y-1.5 min-w-[150px]">
          <div className="flex items-center justify-between text-[#98A2B3] text-[11px] pb-1 border-b border-white/[0.08]">
            <span>{point.timeLabel}</span>
            <span className="text-[#00CFFF]">PHIVO</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[#98A2B3]">Rate:</span>
            <span className="text-white font-bold tabular-nums">${point.price.toFixed(4)}</span>
          </div>
          {point.volume > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#98A2B3]">Volume:</span>
              <span className="text-[#00CFFF] font-medium tabular-nums">{point.volume.toLocaleString()}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl p-4 sm:p-6 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between ${className}`}>
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full blur-3xl pointer-events-none bg-[#00CFFF]/5" />

      {/* Top Header & Price Metrics */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
        {/* Token info & current price */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#00CFFF]/20 to-[#168BFF]/10 border border-[#00CFFF]/30 flex items-center justify-center shrink-0 shadow-lg shadow-[#00CFFF]/10">
            <PhivoCoinIcon size={26} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white tracking-tight">PHIVONEX Ecosystem</span>
              <span className="text-[11px] font-mono text-[#00CFFF] bg-[#00CFFF]/10 px-2 py-0.5 rounded border border-[#00CFFF]/20 font-bold">
                PHIVO
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#32D583] bg-[#32D583]/10 px-2 py-0.5 rounded border border-[#32D583]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#32D583]" />
                Configured Rate
              </span>
            </div>

            {/* Price headline */}
            <div className="flex flex-wrap items-baseline gap-2.5 mt-1">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight tabular-nums">
                ${activePrice.toFixed(4)}
              </span>

              {change24hPercent !== 0 ? (
                <div
                  className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-lg border ${
                    change24h >= 0
                      ? 'text-[#32D583] bg-[#32D583]/10 border-[#32D583]/30'
                      : 'text-[#F04438] bg-[#F04438]/10 border-[#F04438]/30'
                  }`}
                >
                  {change24h >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  <span className="tabular-nums">{change24h >= 0 ? '+' : ''}{change24hPercent.toFixed(2)}%</span>
                </div>
              ) : (
                <span className="text-xs font-mono text-[#98A2B3] px-2 py-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08]">
                  Configured Rate
                </span>
              )}

              <span className="text-[11px] text-[#98A2B3] font-mono hidden sm:inline-block">
                USDT Benchmark
              </span>
            </div>
          </div>
        </div>

        {/* Right side: Timeframe buttons & Quick Action */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeframe switchers */}
          <div className="flex items-center bg-[#05070B] p-1 rounded-xl border border-white/[0.08]">
            {(['1h', '6h', '24h', '7d'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-[#00CFFF] text-[#05070B] shadow-md shadow-[#00CFFF]/20'
                    : 'text-[#98A2B3] hover:text-white'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => fetchPriceTrend(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white transition-colors cursor-pointer min-h-[36px]"
            title="Refresh Rate"
            aria-label="Refresh price data"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#00CFFF] ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {/* Swap CTA */}
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('swap')}
              className="px-3 py-1.5 rounded-xl bg-[#00CFFF]/10 hover:bg-[#00CFFF]/20 border border-[#00CFFF]/30 text-[#00CFFF] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[36px]"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Swap PHIVO</span>
            </button>
          )}
        </div>
      </div>

      {/* Authoritative Performance Strip */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-3 border-b border-white/[0.04] text-xs font-mono">
        <div className="p-2.5 rounded-xl bg-[#05070B]/70 border border-white/[0.04]">
          <span className="text-[10px] text-[#98A2B3] block uppercase tracking-wider">24H High</span>
          <span className="font-bold text-white text-xs sm:text-sm tabular-nums mt-0.5 block">
            {data?.high24h && data.high24h > 0 ? `$${data.high24h.toFixed(4)}` : `$${currentPrice.toFixed(4)}`}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#05070B]/70 border border-white/[0.04]">
          <span className="text-[10px] text-[#98A2B3] block uppercase tracking-wider">24H Low</span>
          <span className="font-bold text-white text-xs sm:text-sm tabular-nums mt-0.5 block">
            {data?.low24h && data.low24h > 0 ? `$${data.low24h.toFixed(4)}` : `$${currentPrice.toFixed(4)}`}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#05070B]/70 border border-white/[0.04]">
          <span className="text-[10px] text-[#98A2B3] block uppercase tracking-wider">24H Volume</span>
          <span className="font-bold text-[#00CFFF] text-xs sm:text-sm tabular-nums mt-0.5 block">
            {data?.volume24h && data.volume24h > 0 ? `$${data.volume24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'Not Available'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#05070B]/70 border border-white/[0.04]">
          <span className="text-[10px] text-[#98A2B3] block uppercase tracking-wider">Market Cap</span>
          <span className="font-bold text-white text-xs sm:text-sm tabular-nums mt-0.5 block">
            {data?.marketCap && data.marketCap > 0 ? `$${data.marketCap.toLocaleString('en-US')}` : 'Not Available'}
          </span>
        </div>
      </div>

      {/* Main Recharts Area Chart */}
      <div className="relative z-10 w-full h-[160px] sm:h-[180px] pt-3">
        {loading && !data ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-xs text-[#98A2B3] space-y-2">
            <RefreshCw className="w-5 h-5 animate-spin text-[#00CFFF]" />
            <span>Loading price history...</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data?.points || []}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              onMouseMove={(e: any) => {
                if (e && e.activePayload && e.activePayload.length) {
                  setHoveredPoint(e.activePayload[0].payload);
                }
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="phivoPriceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00CFFF" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00CFFF" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.04)"
                vertical={false}
              />

              <XAxis
                dataKey="timeLabel"
                stroke="#667085"
                tick={{ fill: '#98A2B3', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
                dy={6}
              />

              <YAxis
                domain={[minVal, maxVal]}
                stroke="#667085"
                tick={{ fill: '#98A2B3', fontSize: 10, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${Number(val).toFixed(2)}`}
              />

              <Tooltip content={<CustomOhlcTooltip />} />

              <Area
                type="monotone"
                dataKey="price"
                stroke="#00CFFF"
                strokeWidth={2}
                fill="url(#phivoPriceGradient)"
                isAnimationActive={true}
                dot={false}
                activeDot={{
                  r: 5,
                  fill: '#00CFFF',
                  stroke: '#05070B',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom Footer Info */}
      <div className="relative z-10 pt-3 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#98A2B3] gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-[#00CFFF]" />
          <span>
            {data?.updatedAt ? `Last synchronized: ${new Date(data.updatedAt).toLocaleTimeString()}` : 'Real-time synchronization'}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[10px]">
          <span>
            Current Base Rate: <strong className="text-white">${currentPrice.toFixed(4)} USDT</strong>
          </span>
          <span className="text-[#32D583]">Authoritative Ledger</span>
        </div>
      </div>
    </div>
  );
};
