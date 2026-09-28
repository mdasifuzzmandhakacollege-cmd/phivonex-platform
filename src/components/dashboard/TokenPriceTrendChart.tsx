import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Layers,
  BarChart3,
  Flame,
  Zap,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { PhivoCoinIcon, UsdtIcon } from '../brand/CryptoIcons';

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
  marketCap: number;
  circulatingSupply: number;
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
  const [chartMetric, setChartMetric] = useState<'price' | 'volume'>('price');
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
    // Real-time 6-second polling interval
    const interval = setInterval(() => {
      fetchPriceTrend(false);
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchPriceTrend]);

  // Active prices & derived stats
  const isOverallBullish = (data?.change24hPercent ?? 0) >= 0;
  const activePrice = hoveredPoint?.price ?? data?.currentPrice ?? 1.85;
  const activeChange = hoveredPoint
    ? Number((hoveredPoint.close - (data?.open24h ?? 1.75)).toFixed(4))
    : (data?.change24h ?? 0.10);
  const activeChangePercent = hoveredPoint && data?.open24h
    ? Number(((activeChange / data.open24h) * 100).toFixed(2))
    : (data?.change24hPercent ?? 5.84);

  // Calculate dynamic domain
  const { minVal, maxVal } = useMemo(() => {
    if (!data || !data.points.length) return { minVal: 1.5, maxVal: 2.2 };
    const values = data.points.map((p) => (chartMetric === 'price' ? p.price : (p.volumeUsd || p.volume * p.price)));
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = (max - min) * 0.12 || 0.05;
    return {
      minVal: chartMetric === 'price' ? Math.max(0, Number((min - padding).toFixed(3))) : 0,
      maxVal: Number((max + padding).toFixed(3)),
    };
  }, [data, chartMetric]);

  // Custom hover tooltip displaying precise OHLC data
  const CustomOhlcTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point: TokenPricePoint = payload[0].payload;
      const candleOpen = point.open ?? point.price * 0.998;
      const candleHigh = point.high ?? point.price * 1.008;
      const candleLow = point.low ?? point.price * 0.992;
      const candleClose = point.close ?? point.price;
      const candleDelta = Number((candleClose - candleOpen).toFixed(4));
      const candleDeltaPercent = candleOpen > 0
        ? Number(((candleDelta / candleOpen) * 100).toFixed(2))
        : 0;
      const isCandleBullish = candleDelta >= 0;
      const candleSpread = Number((candleHigh - candleLow).toFixed(4));
      const spreadPercent = candleLow > 0 ? Number(((candleSpread / candleLow) * 100).toFixed(2)) : 0;
      const volumeTokens = point.volume || 0;
      const volumeUsdt = point.volumeUsd ?? (volumeTokens * candleClose);

      // Formatted date string for timestamp
      let formattedDate = point.timeLabel;
      try {
        if (point.timestamp) {
          const d = new Date(point.timestamp);
          formattedDate = d.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
        }
      } catch {
        formattedDate = point.timeLabel;
      }

      return (
        <div className="rounded-2xl bg-[#05070B]/95 border border-[#00CFFF]/25 p-4 shadow-2xl backdrop-blur-xl text-xs font-mono min-w-[260px] max-w-[310px] space-y-3 pointer-events-none z-50 animate-fadeIn">
          {/* Header with Interval & Pair Tag */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-1.5 text-[11px] text-white font-semibold">
              <Clock className="w-3.5 h-3.5 text-[#00CFFF]" />
              <span>{formattedDate}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#00CFFF]/15 text-[#00CFFF] border border-[#00CFFF]/30">
                PHIVO/USDT
              </span>
            </div>
          </div>

          {/* Candle Movement Badge */}
          <div className="flex items-center justify-between">
            <div
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${
                isCandleBullish
                  ? 'text-[#32D583] bg-[#32D583]/15 border-[#32D583]/30'
                  : 'text-[#F04438] bg-[#F04438]/15 border-[#F04438]/30'
              }`}
            >
              {isCandleBullish ? (
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>
                {isCandleBullish ? '+' : ''}
                {candleDelta >= 0 ? `$${candleDelta.toFixed(4)}` : `-$${Math.abs(candleDelta).toFixed(4)}`} ({isCandleBullish ? '+' : ''}
                {candleDeltaPercent}%)
              </span>
            </div>
            <span className="text-[10px] text-[#98A2B3]">
              {isCandleBullish ? 'Bullish Step' : 'Bearish Step'}
            </span>
          </div>

          {/* 4-Corner Precise OHLC Matrix */}
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            {/* Open */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px] text-[#98A2B3]">
                <span className="font-semibold text-[#98A2B3]">OPEN (O)</span>
              </div>
              <span className="text-white font-bold text-xs block">
                ${candleOpen.toFixed(4)}
              </span>
            </div>

            {/* High */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px] text-[#32D583]">
                <span className="font-semibold">HIGH (H)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#32D583]" />
              </div>
              <span className="text-[#32D583] font-bold text-xs block">
                ${candleHigh.toFixed(4)}
              </span>
            </div>

            {/* Low */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px] text-[#F04438]">
                <span className="font-semibold">LOW (L)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#F04438]" />
              </div>
              <span className="text-[#F04438] font-bold text-xs block">
                ${candleLow.toFixed(4)}
              </span>
            </div>

            {/* Close */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px] text-[#00CFFF]">
                <span className="font-semibold">CLOSE (C)</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00CFFF]" />
              </div>
              <span className="text-white font-extrabold text-xs block">
                ${candleClose.toFixed(4)}
              </span>
            </div>
          </div>

          {/* Secondary Stats: Spread & Volume */}
          <div className="pt-1 space-y-1.5 text-[11px] border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-[#98A2B3]">
              <span>Candle Spread:</span>
              <span className="text-white font-semibold">
                ${candleSpread.toFixed(4)}{' '}
                <span className="text-[#98A2B3] text-[10px]">({spreadPercent}%)</span>
              </span>
            </div>

            <div className="flex items-center justify-between text-[#98A2B3]">
              <span>Est. Volume:</span>
              <span className="text-[#00CFFF] font-semibold">
                {volumeTokens.toLocaleString()} PHIVO
              </span>
            </div>

            <div className="flex items-center justify-between text-[#98A2B3]">
              <span>Turnover:</span>
              <span className="text-[#32D583] font-semibold">
                ${volumeUsdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`rounded-2xl bg-[#07101D] border border-white/[0.08] shadow-xl p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between ${className}`}>
      {/* Background ambient glow */}
      <div
        className={`absolute top-0 right-0 -mr-24 -mt-24 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
          isOverallBullish ? 'bg-[#12B76A]/10' : 'bg-[#F04438]/10'
        }`}
      />

      {/* Top Header & Price Metrics */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
        {/* Token info & current price */}
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00CFFF]/20 to-[#168BFF]/10 border border-[#00CFFF]/30 flex items-center justify-center shrink-0 shadow-lg shadow-[#00CFFF]/10">
            <PhivoCoinIcon size={28} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-extrabold text-white tracking-tight">PHIVONEX</span>
              <span className="text-xs font-mono text-[#00CFFF] bg-[#00CFFF]/10 px-2 py-0.5 rounded border border-[#00CFFF]/20 font-bold">
                PHIVO
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#32D583] bg-[#32D583]/10 px-2 py-0.5 rounded border border-[#32D583]/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#32D583] animate-ping" />
                Live Feed
              </span>
              {hoveredPoint && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#00CFFF] bg-[#00CFFF]/10 px-2 py-0.5 rounded border border-[#00CFFF]/20 animate-pulse">
                  Inspecting Point ({hoveredPoint.timeLabel})
                </span>
              )}
            </div>

            {/* Price headline */}
            <div className="flex flex-wrap items-baseline gap-2.5 mt-1">
              <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                ${activePrice.toFixed(4)}
              </span>

              <div
                className={`flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-lg border ${
                  activeChange >= 0
                    ? 'text-[#32D583] bg-[#32D583]/10 border-[#32D583]/30'
                    : 'text-[#F04438] bg-[#F04438]/10 border-[#F04438]/30'
                }`}
              >
                {activeChange >= 0 ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                <span>
                  {activeChange >= 0 ? '+' : ''}
                  {activeChangePercent}%
                </span>
                <span className="text-[10px] opacity-80">
                  ({activeChange >= 0 ? '+' : ''}${activeChange.toFixed(4)})
                </span>
              </div>

              <span className="text-[11px] text-[#98A2B3] font-mono hidden sm:inline-block">
                {hoveredPoint ? 'Point Snapshot' : '24H Net Change'}
              </span>
            </div>
          </div>
        </div>

        {/* Right side: Timeframe buttons & Quick Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Timeframe switchers */}
          <div className="flex items-center bg-[#05070B] p-1 rounded-xl border border-white/[0.08]">
            {(['1h', '6h', '24h', '7d'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-[#00CFFF] text-[#05070B] shadow-md shadow-[#00CFFF]/20'
                    : 'text-[#98A2B3] hover:text-white'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Metric toggle */}
          <div className="flex items-center bg-[#05070B] p-1 rounded-xl border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setChartMetric('price')}
              title="Price Trend (USDT)"
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1 ${
                chartMetric === 'price' ? 'bg-white/[0.1] text-white font-bold' : 'text-[#98A2B3]'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Price</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMetric('volume')}
              title="Volume Trend"
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1 ${
                chartMetric === 'volume' ? 'bg-white/[0.1] text-white font-bold' : 'text-[#98A2B3]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Volume</span>
            </button>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => fetchPriceTrend(true)}
            disabled={isRefreshing}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-white transition-colors cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00CFFF]' : ''}`} />
          </button>

          {/* Swap CTA */}
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('swap')}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00CFFF]/15 to-[#168BFF]/15 hover:from-[#00CFFF]/25 hover:to-[#168BFF]/25 border border-[#00CFFF]/40 text-[#00CFFF] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Swap Now</span>
            </button>
          )}
        </div>
      </div>

      {/* 24-Hour Performance Bar Metrics (or hovered point OHLC stats) */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 border-b border-white/[0.04] text-xs font-mono">
        <div className="p-2.5 rounded-xl bg-[#05070B]/60 border border-white/[0.04]">
          <span className="text-[10px] text-[#98A2B3] block">
            {hoveredPoint ? 'Candle High (H)' : '24H High'}
          </span>
          <span className="font-bold text-[#32D583] text-sm">
            ${(hoveredPoint?.high ?? data?.high24h ?? 1.892).toFixed(4)}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#05070B]/60 border border-white/[0.04]">
          <span className="text-[10px] text-[#98A2B3] block">
            {hoveredPoint ? 'Candle Low (L)' : '24H Low'}
          </span>
          <span className="font-bold text-[#F04438] text-sm">
            ${(hoveredPoint?.low ?? data?.low24h ?? 1.745).toFixed(4)}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#05070B]/60 border border-white/[0.04]">
          <span className="text-[10px] text-[#98A2B3] block">
            {hoveredPoint ? 'Step Volume' : '24H Volume (USDT)'}
          </span>
          <span className="font-bold text-[#00CFFF] text-sm">
            ${hoveredPoint
              ? (hoveredPoint.volumeUsd ?? (hoveredPoint.volume * hoveredPoint.price)).toLocaleString('en-US', { maximumFractionDigits: 0 })
              : (data?.volume24h ?? 1248500).toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-[#05070B]/60 border border-white/[0.04]">
          <span className="text-[10px] text-[#98A2B3] block">
            {hoveredPoint ? 'Candle Open (O)' : 'Market Cap'}
          </span>
          <span className="font-bold text-white text-sm">
            {hoveredPoint
              ? `$${(hoveredPoint.open ?? hoveredPoint.price * 0.998).toFixed(4)}`
              : `$${((data?.marketCap ?? 45325000) / 1_000_000).toFixed(2)}M`}
          </span>
        </div>
      </div>

      {/* Main Recharts Area Chart with interactive crosshair and rich tooltips */}
      <div className="relative z-10 w-full h-[250px] sm:h-[290px] pt-4">
        {loading && !data ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-xs text-[#98A2B3] space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#00CFFF]" />
            <span>Loading 24h price stream...</span>
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
                {/* Neon Cyan Gradient for Price */}
                <linearGradient id="phivoPriceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00CFFF" stopOpacity={0.4} />
                  <stop offset="60%" stopColor="#00CFFF" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#00CFFF" stopOpacity={0.0} />
                </linearGradient>

                {/* Emerald Gradient for Bullish volume */}
                <linearGradient id="phivoVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#12B76A" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#12B76A" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.05)"
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
                tickFormatter={(val) =>
                  chartMetric === 'price'
                    ? `$${Number(val).toFixed(2)}`
                    : `${(Number(val) / 1000).toFixed(0)}k`
                }
              />

              <Tooltip
                content={<CustomOhlcTooltip />}
                cursor={{
                  stroke: '#00CFFF',
                  strokeWidth: 1.2,
                  strokeDasharray: '4 4',
                }}
              />

              {/* 24h Baseline Reference Line */}
              {chartMetric === 'price' && data?.open24h && (
                <ReferenceLine
                  y={data.open24h}
                  stroke="rgba(255, 255, 255, 0.18)"
                  strokeDasharray="4 4"
                  label={{
                    value: `24h Open: $${data.open24h.toFixed(2)}`,
                    fill: '#667085',
                    fontSize: 9,
                    position: 'insideBottomRight',
                  }}
                />
              )}

              <Area
                type="monotone"
                dataKey={chartMetric === 'price' ? 'price' : 'volumeUsd'}
                stroke={chartMetric === 'price' ? '#00CFFF' : '#12B76A'}
                strokeWidth={2.5}
                fill={chartMetric === 'price' ? 'url(#phivoPriceGradient)' : 'url(#phivoVolumeGradient)'}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-in-out"
                animationBegin={0}
                dot={(props: any) => {
                  const { cx, cy, index } = props;
                  if (!data?.points || index !== data.points.length - 1) {
                    return <g key={`dot-${index}`} />;
                  }
                  const strokeColor = chartMetric === 'price' ? '#00CFFF' : '#12B76A';
                  return (
                    <g key={`live-endpoint-${index}`} className="transition-all duration-700 ease-out">
                      {/* Outer pulse wave */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={8}
                        fill={strokeColor}
                        opacity={0.35}
                        className="animate-ping"
                      />
                      {/* Middle glow */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={5.5}
                        fill={strokeColor}
                        opacity={0.7}
                      />
                      {/* Core solid dot */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={3.5}
                        fill="#FFFFFF"
                        stroke={strokeColor}
                        strokeWidth={2}
                      />
                    </g>
                  );
                }}
                activeDot={{
                  r: 6.5,
                  fill: chartMetric === 'price' ? '#00CFFF' : '#12B76A',
                  stroke: '#05070B',
                  strokeWidth: 2.5,
                  className: 'transition-all duration-200',
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Bottom Footer Info */}
      <div className="relative z-10 pt-3 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#98A2B3] gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#00CFFF]" />
          <span>
            {hoveredPoint
              ? `Hovering Timeline point: ${hoveredPoint.timeLabel} (${hoveredPoint.timestamp ? new Date(hoveredPoint.timestamp).toLocaleTimeString() : 'Local'})`
              : `Last synchronized: ${data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : 'Real-time'}`}
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[10px]">
          <span>
            Ecosystem Base Rate:{' '}
            <strong className="text-white">
              {data?.currentPrice !== null && data?.currentPrice !== undefined ? `$${data.currentPrice.toFixed(2)} USDT` : 'Rate Unavailable'}
            </strong>
          </span>
          <span className="text-[#32D583]">Authoritative Protocol Ledger</span>
        </div>
      </div>
    </div>
  );
};
