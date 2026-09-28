import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  Server,
  Zap,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Pause,
  Info,
  Globe,
  Database,
  Cpu,
  Layers,
  Search,
  Filter,
  X,
  Radio,
  BarChart2,
  Share2
} from 'lucide-react';
import { UserProfile } from '../../context/AuthContext';

interface NodeHealthViewProps {
  user?: UserProfile;
  onNavigateTab?: (tab: string) => void;
}

interface GenesisNodeHealth {
  id: string;
  publicNodeId: string;
  nodeNumber: number;
  region: string;
  regionCode: string;
  status: 'ONLINE' | 'SYNCING' | 'DEGRADED' | 'OFFLINE';
  syncDelayMs: number;
  pingMs: number;
  blockLag: number;
  uptimePct: number;
  packetLossPct: number;
  peerCount: number;
  lastHeartbeat: string;
  ipMasked: string;
}

interface TimeSeriesPoint {
  timestamp: Date;
  avgSyncDelayMs: number;
  maxSyncDelayMs: number;
  avgPingMs: number;
  activeNodeCount: number;
  healthIndexPct: number;
}

const REGIONS = [
  { name: 'Frankfurt, EU', code: 'FRA-1' },
  { name: 'Tokyo, AP', code: 'TYO-2' },
  { name: 'N. Virginia, US', code: 'IAD-1' },
  { name: 'Singapore, AP', code: 'SIN-1' },
  { name: 'London, EU', code: 'LHR-1' },
  { name: 'São Paulo, SA', code: 'GRU-1' },
  { name: 'Sydney, AU', code: 'SYD-1' },
];

export const NodeHealthView: React.FC<NodeHealthViewProps> = ({ onNavigateTab }) => {
  const [nodes, setNodes] = useState<GenesisNodeHealth[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesPoint[]>([]);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<number>(2);
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeframe, setTimeframe] = useState<'1M' | '5M' | '15M' | '1H'>('5M');
  const [selectedNode, setSelectedNode] = useState<GenesisNodeHealth | null>(null);
  const [benchmarkNodeId, setBenchmarkNodeId] = useState<string | null>(null);
  const [benchmarkResult, setBenchmarkResult] = useState<{ node: string; ping: number; loss: number } | null>(null);

  // D3 Chart Refs
  const timelineChartRef = useRef<SVGSVGElement | null>(null);
  const topologyChartRef = useRef<SVGSVGElement | null>(null);
  const distributionChartRef = useRef<SVGSVGElement | null>(null);

  // Generate initial node data
  const generateInitialNodes = useCallback((): GenesisNodeHealth[] => {
    const list: GenesisNodeHealth[] = [];
    const totalNodes = 24;

    for (let i = 1; i <= totalNodes; i++) {
      const reg = REGIONS[(i - 1) % REGIONS.length];
      const isDegraded = i === 7 || i === 18;
      const isSyncing = i === 12;

      let status: GenesisNodeHealth['status'] = 'ONLINE';
      let syncDelayMs = Math.floor(Math.random() * 18) + 8; // 8-26ms
      let pingMs = Math.floor(Math.random() * 25) + 12; // 12-37ms
      let blockLag = 0;
      let packetLossPct = 0;

      if (isDegraded) {
        status = 'DEGRADED';
        syncDelayMs = Math.floor(Math.random() * 80) + 90; // 90-170ms
        pingMs = Math.floor(Math.random() * 60) + 110;
        blockLag = Math.floor(Math.random() * 3) + 1;
        packetLossPct = Number((Math.random() * 2.5 + 0.5).toFixed(1));
      } else if (isSyncing) {
        status = 'SYNCING';
        syncDelayMs = Math.floor(Math.random() * 40) + 45;
        pingMs = Math.floor(Math.random() * 30) + 40;
        blockLag = 1;
      }

      list.push({
        id: `node-${i}`,
        publicNodeId: `PX-NODE-${String(i).padStart(6, '0')}`,
        nodeNumber: i,
        region: reg.name,
        regionCode: reg.code,
        status,
        syncDelayMs,
        pingMs,
        blockLag,
        uptimePct: Number((99.85 + Math.random() * 0.14).toFixed(2)),
        packetLossPct,
        peerCount: Math.floor(Math.random() * 12) + 18,
        lastHeartbeat: `${Math.floor(Math.random() * 800) + 100}ms ago`,
        ipMasked: `185.${120 + ((i * 7) % 100)}.${(i * 13) % 255}.***`,
      });
    }

    return list;
  }, []);

  // Initialize nodes and time-series history
  useEffect(() => {
    const initial = generateInitialNodes();
    setNodes(initial);

    // Build 20 historical points
    const now = new Date();
    const history: TimeSeriesPoint[] = [];

    for (let i = 20; i >= 0; i--) {
      const ptTime = new Date(now.getTime() - i * 5000);
      const avgDelay = 14 + Math.sin(i / 2) * 4 + (Math.random() * 4 - 2);
      const maxDelay = avgDelay + 25 + Math.random() * 15;
      const avgPing = avgDelay + 8 + Math.random() * 5;
      const healthPct = 99.7 + (Math.random() * 0.25 - 0.1);

      history.push({
        timestamp: ptTime,
        avgSyncDelayMs: Number(avgDelay.toFixed(2)),
        maxSyncDelayMs: Number(maxDelay.toFixed(2)),
        avgPingMs: Number(avgPing.toFixed(2)),
        activeNodeCount: 24,
        healthIndexPct: Number(Math.min(100, Math.max(98, healthPct)).toFixed(2)),
      });
    }

    setTimeSeriesData(history);
  }, [generateInitialNodes]);

  // Live simulation update interval
  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setNodes((prevNodes) =>
        prevNodes.map((node) => {
          // slight random jitter
          const jitter = Math.floor(Math.random() * 7) - 3;
          let newSync = Math.max(4, node.syncDelayMs + jitter);
          let newPing = Math.max(8, node.pingMs + Math.floor(Math.random() * 5) - 2);

          if (node.status === 'DEGRADED') {
            newSync = Math.max(70, Math.min(220, newSync));
          } else if (node.status === 'ONLINE') {
            newSync = Math.min(38, Math.max(5, newSync));
          }

          return {
            ...node,
            syncDelayMs: newSync,
            pingMs: newPing,
            lastHeartbeat: `${Math.floor(Math.random() * 400) + 80}ms ago`,
          };
        })
      );

      setTimeSeriesData((prevSeries) => {
        const nextTime = new Date();
        const currentNodes = nodes.length > 0 ? nodes : generateInitialNodes();
        const totalDelay = currentNodes.reduce((acc, n) => acc + n.syncDelayMs, 0);
        const avgDelay = currentNodes.length ? totalDelay / currentNodes.length : 15;
        const maxDelay = Math.max(...currentNodes.map((n) => n.syncDelayMs), 35);
        const avgPing = currentNodes.length ? currentNodes.reduce((acc, n) => acc + n.pingMs, 0) / currentNodes.length : 22;

        const onlineCount = currentNodes.filter((n) => n.status === 'ONLINE').length;
        const healthPct = (onlineCount / currentNodes.length) * 100;

        const newPoint: TimeSeriesPoint = {
          timestamp: nextTime,
          avgSyncDelayMs: Number(avgDelay.toFixed(2)),
          maxSyncDelayMs: Number(maxDelay.toFixed(2)),
          avgPingMs: Number(avgPing.toFixed(2)),
          activeNodeCount: currentNodes.length,
          healthIndexPct: Number(healthPct.toFixed(2)),
        };

        const updated = [...prevSeries.slice(1), newPoint];
        return updated;
      });
    }, refreshIntervalSec * 1000);

    return () => clearInterval(interval);
  }, [isLive, refreshIntervalSec, nodes, generateInitialNodes]);

  // ---------------------------------------------------------------------------
  // D3 CHART 1: Real-Time Synchronization Delay Timeline
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!timelineChartRef.current || timeSeriesData.length === 0) return;

    const svg = d3.select(timelineChartRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const width = timelineChartRef.current.clientWidth || 700;
    const height = 260;
    const margin = { top: 20, right: 30, bottom: 35, left: 45 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(timeSeriesData, (d) => d.timestamp) as [Date, Date])
      .range([0, innerWidth]);

    const maxVal = d3.max(timeSeriesData, (d) => d.maxSyncDelayMs) || 100;
    const yScale = d3
      .scaleLinear()
      .domain([0, Math.max(60, maxVal * 1.15)])
      .range([innerHeight, 0]);

    // Grid lines
    const yGrid = d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(() => '');
    g.append('g')
      .attr('class', 'grid-lines')
      .call(yGrid)
      .selectAll('line')
      .attr('stroke', 'rgba(255, 255, 255, 0.06)')
      .attr('stroke-dasharray', '3,3');

    // Gradient definitions
    const defs = svg.append('defs');

    // Area Gradient for Avg Delay
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'delay-area-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient.append('stop').attr('offset', '0%').attr('stop-color', '#00CFFF').attr('stop-opacity', 0.35);
    areaGradient.append('stop').attr('offset', '100%').attr('stop-color', '#00CFFF').attr('stop-opacity', 0.0);

    // Area Generator
    const areaGen = d3
      .area<TimeSeriesPoint>()
      .x((d) => xScale(d.timestamp))
      .y0(innerHeight)
      .y1((d) => yScale(d.avgSyncDelayMs))
      .curve(d3.curveMonotoneX);

    // Line Generators
    const lineAvg = d3
      .line<TimeSeriesPoint>()
      .x((d) => xScale(d.timestamp))
      .y((d) => yScale(d.avgSyncDelayMs))
      .curve(d3.curveMonotoneX);

    const lineMax = d3
      .line<TimeSeriesPoint>()
      .x((d) => xScale(d.timestamp))
      .y((d) => yScale(d.maxSyncDelayMs))
      .curve(d3.curveMonotoneX);

    // Draw Area
    g.append('path')
      .datum(timeSeriesData)
      .attr('fill', 'url(#delay-area-grad)')
      .attr('d', areaGen);

    // Draw Max Delay Line (Dashed Amber)
    g.append('path')
      .datum(timeSeriesData)
      .attr('fill', 'none')
      .attr('stroke', '#F59E0B')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.75)
      .attr('d', lineMax);

    // Draw Avg Delay Line (Cyan Solid)
    g.append('path')
      .datum(timeSeriesData)
      .attr('fill', 'none')
      .attr('stroke', '#00CFFF')
      .attr('stroke-width', 2.5)
      .attr('d', lineAvg);

    // Draw Data Dots for Avg Line
    g.selectAll('.dot')
      .data(timeSeriesData)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(d.timestamp))
      .attr('cy', (d) => yScale(d.avgSyncDelayMs))
      .attr('r', 3)
      .attr('fill', '#00CFFF')
      .attr('stroke', '#05070B')
      .attr('stroke-width', 1.5);

    // X Axis
    const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat('%H:%M:%S') as any);
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#98A2B3')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Y Axis
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d} ms`);
    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', '#98A2B3')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Interactive Hover Overlay Crosshair & Tooltip
    const hoverGroup = g.append('g').style('display', 'none');

    hoverGroup
      .append('line')
      .attr('class', 'crosshair-line')
      .attr('stroke', '#00CFFF')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .attr('y1', 0)
      .attr('y2', innerHeight);

    const hoverFocus = hoverGroup.append('circle').attr('r', 5).attr('fill', '#00CFFF').attr('stroke', '#FFFFFF').attr('stroke-width', 2);

    // Overlay Rect for Mouse Interaction
    svg
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseover', () => hoverGroup.style('display', null))
      .on('mouseout', () => hoverGroup.style('display', 'none'))
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event, g.node());
        const xDate = xScale.invert(mx);
        const bisect = d3.bisector((d: TimeSeriesPoint) => d.timestamp).left;
        const index = bisect(timeSeriesData, xDate, 1);
        const d0 = timeSeriesData[index - 1];
        const d1 = timeSeriesData[index];

        if (!d0) return;
        const d = d1 && xDate.getTime() - d0.timestamp.getTime() > d1.timestamp.getTime() - xDate.getTime() ? d1 : d0;

        const cx = xScale(d.timestamp);
        const cy = yScale(d.avgSyncDelayMs);

        hoverGroup.select('.crosshair-line').attr('x1', cx).attr('x2', cx);
        hoverFocus.attr('cx', cx).attr('cy', cy);
      });
  }, [timeSeriesData]);

  // ---------------------------------------------------------------------------
  // D3 CHART 2: Genesis Nodes Topology & Status Force Network
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!topologyChartRef.current || nodes.length === 0) return;

    const svg = d3.select(topologyChartRef.current);
    svg.selectAll('*').remove();

    const width = topologyChartRef.current.clientWidth || 500;
    const height = 320;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodesData = [
      { id: 'HUB', label: 'PHIVONEX CORE', type: 'HUB', status: 'ONLINE', x: centerX, y: centerY },
      ...nodes.map((n) => ({
        id: n.id,
        label: n.publicNodeId,
        type: 'NODE',
        status: n.status,
        syncDelayMs: n.syncDelayMs,
        regionCode: n.regionCode,
        data: n,
      })),
    ];

    const linksData = nodes.map((n) => ({
      source: 'HUB',
      target: n.id,
      syncDelayMs: n.syncDelayMs,
    }));

    const simulation = d3
      .forceSimulation(nodesData as any)
      .force('link', d3.forceLink(linksData).id((d: any) => d.id).distance(110).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-120))
      .force('center', d3.forceCenter(centerX, centerY))
      .force('collide', d3.forceCollide(24));

    const svgG = svg.attr('viewBox', `0 0 ${width} ${height}`).append('g');

    // Draw Links
    const link = svgG
      .append('g')
      .selectAll('line')
      .data(linksData)
      .enter()
      .append('line')
      .attr('stroke', (d) => {
        if (d.syncDelayMs > 90) return 'rgba(240, 68, 56, 0.5)';
        if (d.syncDelayMs > 40) return 'rgba(245, 158, 11, 0.5)';
        return 'rgba(0, 207, 255, 0.25)';
      })
      .attr('stroke-width', (d) => (d.syncDelayMs > 90 ? 2 : 1))
      .attr('stroke-dasharray', (d) => (d.syncDelayMs > 90 ? '3,3' : 'none'));

    // Draw Node Groups
    const node = svgG
      .append('g')
      .selectAll('.node-group')
      .data(nodesData)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .on('click', (_, d: any) => {
        if (d.data) {
          setSelectedNode(d.data);
        }
      });

    // Node Circles
    node
      .append('circle')
      .attr('r', (d) => (d.type === 'HUB' ? 22 : 12))
      .attr('fill', (d) => {
        if (d.type === 'HUB') return '#00CFFF';
        if (d.status === 'ONLINE') return '#32D583';
        if (d.status === 'SYNCING') return '#3B82F6';
        if (d.status === 'DEGRADED') return '#F04438';
        return '#98A2B3';
      })
      .attr('fill-opacity', (d) => (d.type === 'HUB' ? 0.25 : 0.85))
      .attr('stroke', (d) => {
        if (d.type === 'HUB') return '#00CFFF';
        if (d.status === 'ONLINE') return '#32D583';
        if (d.status === 'SYNCING') return '#3B82F6';
        if (d.status === 'DEGRADED') return '#F04438';
        return '#98A2B3';
      })
      .attr('stroke-width', (d) => (d.type === 'HUB' ? 2.5 : 1.5));

    // Outer Glow Ring for Hub
    svgG
      .append('circle')
      .attr('cx', centerX)
      .attr('cy', centerY)
      .attr('r', 28)
      .attr('fill', 'none')
      .attr('stroke', '#00CFFF')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4')
      .attr('opacity', 0.5);

    // Node Labels
    node
      .append('text')
      .text((d) => (d.type === 'HUB' ? 'HUB' : (d as any).regionCode))
      .attr('dy', (d) => (d.type === 'HUB' ? 4 : 18))
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .attr('font-size', (d) => (d.type === 'HUB' ? '10px' : '9px'))
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });
  }, [nodes]);

  // ---------------------------------------------------------------------------
  // D3 CHART 3: Sync Delay Distribution Histogram
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!distributionChartRef.current || nodes.length === 0) return;

    const svg = d3.select(distributionChartRef.current);
    svg.selectAll('*').remove();

    const width = distributionChartRef.current.clientWidth || 350;
    const height = 180;
    const margin = { top: 15, right: 15, bottom: 30, left: 35 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Define Buckets
    const buckets = [
      { label: '<15ms', count: nodes.filter((n) => n.syncDelayMs < 15).length, color: '#32D583' },
      { label: '15-30ms', count: nodes.filter((n) => n.syncDelayMs >= 15 && n.syncDelayMs <= 30).length, color: '#00CFFF' },
      { label: '30-60ms', count: nodes.filter((n) => n.syncDelayMs > 30 && n.syncDelayMs <= 60).length, color: '#3B82F6' },
      { label: '60-100ms', count: nodes.filter((n) => n.syncDelayMs > 60 && n.syncDelayMs <= 100).length, color: '#F59E0B' },
      { label: '>100ms', count: nodes.filter((n) => n.syncDelayMs > 100).length, color: '#F04438' },
    ];

    const xScale = d3
      .scaleBand()
      .domain(buckets.map((b) => b.label))
      .range([0, innerWidth])
      .padding(0.25);

    const maxCount = d3.max(buckets, (b) => b.count) || 5;
    const yScale = d3
      .scaleLinear()
      .domain([0, Math.max(5, maxCount + 2)])
      .range([innerHeight, 0]);

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Bars
    g.selectAll('.bar')
      .data(buckets)
      .enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', (d) => xScale(d.label) || 0)
      .attr('y', (d) => yScale(d.count))
      .attr('width', xScale.bandwidth())
      .attr('height', (d) => innerHeight - yScale(d.count))
      .attr('fill', (d) => d.color)
      .attr('rx', 4);

    // Value Labels on top of bars
    g.selectAll('.bar-label')
      .data(buckets)
      .enter()
      .append('text')
      .attr('x', (d) => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
      .attr('y', (d) => yScale(d.count) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#FFFFFF')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .attr('font-family', 'monospace')
      .text((d) => (d.count > 0 ? d.count : '0'));

    // X Axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .attr('fill', '#98A2B3')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');

    // Y Axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
      .selectAll('text')
      .attr('fill', '#98A2B3')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace');
  }, [nodes]);

  // Filtered nodes for Table
  const filteredNodes = nodes.filter((node) => {
    if (selectedRegion !== 'ALL' && !node.region.includes(selectedRegion)) {
      return false;
    }
    if (selectedStatus !== 'ALL' && node.status !== selectedStatus) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        node.publicNodeId.toLowerCase().includes(q) ||
        node.region.toLowerCase().includes(q) ||
        node.ipMasked.includes(q)
      );
    }
    return true;
  });

  // Calculate Overall SLA & Metrics
  const onlineCount = nodes.filter((n) => n.status === 'ONLINE').length;
  const syncingCount = nodes.filter((n) => n.status === 'SYNCING').length;
  const degradedCount = nodes.filter((n) => n.status === 'DEGRADED').length;
  const avgSyncMs = nodes.length ? (nodes.reduce((a, b) => a + b.syncDelayMs, 0) / nodes.length).toFixed(1) : '14.2';
  const avgPingMs = nodes.length ? (nodes.reduce((a, b) => a + b.pingMs, 0) / nodes.length).toFixed(1) : '22.8';

  // Benchmark Ping Simulation
  const handleTestPing = (publicNodeId: string) => {
    setBenchmarkNodeId(publicNodeId);
    setBenchmarkResult(null);

    setTimeout(() => {
      const simPing = Math.floor(Math.random() * 15) + 12;
      setBenchmarkResult({
        node: publicNodeId,
        ping: simPing,
        loss: 0,
      });
      setBenchmarkNodeId(null);
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fadeIn selection:bg-[#00CFFF]/20 selection:text-[#00CFFF]">
      
      {/* 1. HEADER & REAL-TIME CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#00CFFF] uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5" />
            <span>PHIVONEX Genesis Consensus Telemetry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1 flex items-center gap-3">
            Genesis Node Health &amp; Sync Matrix
          </h1>
          <p className="text-sm text-[#98A2B3] mt-1 max-w-2xl">
            Real-time D3.js visualization monitoring synchronization latency, packet transit delay, and peer heartbeat across all active Genesis Nodes.
          </p>
        </div>

        {/* Live Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
              isLive
                ? 'bg-[#32D583]/15 text-[#32D583] border-[#32D583]/30 hover:bg-[#32D583]/25'
                : 'bg-white/[0.04] text-[#98A2B3] border-white/[0.08] hover:bg-white/[0.08]'
            }`}
          >
            {isLive ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#32D583] animate-ping" />
                  <span>LIVE STREAMING</span>
                </span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>PAUSED</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1.5 bg-[#07101D] border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-xs text-[#98A2B3] font-mono">
            <span>Interval:</span>
            <select
              value={refreshIntervalSec}
              onChange={(e) => setRefreshIntervalSec(Number(e.target.value))}
              className="bg-transparent text-white focus:outline-none cursor-pointer font-bold"
            >
              <option value={1} className="bg-[#07101D] text-white">1s</option>
              <option value={2} className="bg-[#07101D] text-white">2s</option>
              <option value={5} className="bg-[#07101D] text-white">5s</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. TELEMETRY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Network Health Index */}
        <div className="p-4 rounded-2xl bg-[#07101D]/80 border border-white/[0.08] backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs text-[#98A2B3]">
            <span>Consensus SLA Index</span>
            <CheckCircle2 className="w-4 h-4 text-[#32D583]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white font-mono tracking-tight">99.88%</span>
            <span className="text-[10px] text-[#32D583] font-mono font-bold">OPTIMAL</span>
          </div>
          <div className="text-[11px] text-[#98A2B3]">
            24 / 24 active validators reporting valid state
          </div>
        </div>

        {/* Card 2: Average Sync Delay */}
        <div className="p-4 rounded-2xl bg-[#07101D]/80 border border-white/[0.08] backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs text-[#98A2B3]">
            <span>Avg Synchronization Delay</span>
            <Zap className="w-4 h-4 text-[#00CFFF]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[#00CFFF] font-mono tracking-tight">{avgSyncMs} ms</span>
            <span className="text-[10px] text-[#00CFFF] font-mono">Real-time</span>
          </div>
          <div className="text-[11px] text-[#98A2B3]">
            Target threshold: &lt; 50 ms
          </div>
        </div>

        {/* Card 3: Peer Ping Latency */}
        <div className="p-4 rounded-2xl bg-[#07101D]/80 border border-white/[0.08] backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs text-[#98A2B3]">
            <span>Peer Consensus Latency</span>
            <Globe className="w-4 h-4 text-[#3B82F6]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white font-mono tracking-tight">{avgPingMs} ms</span>
            <span className="text-[10px] text-[#3B82F6] font-mono">7 Global Regions</span>
          </div>
          <div className="text-[11px] text-[#98A2B3]">
            Zero-knowledge handshake latency
          </div>
        </div>

        {/* Card 4: Status Overview Pill */}
        <div className="p-4 rounded-2xl bg-[#07101D]/80 border border-white/[0.08] backdrop-blur-md space-y-2">
          <div className="flex items-center justify-between text-xs text-[#98A2B3]">
            <span>Node Status Breakdown</span>
            <Server className="w-4 h-4 text-[#98A2B3]" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="px-2 py-0.5 rounded bg-[#32D583]/15 text-[#32D583] text-xs font-bold font-mono">
              {onlineCount} Online
            </span>
            <span className="px-2 py-0.5 rounded bg-[#3B82F6]/15 text-[#3B82F6] text-xs font-bold font-mono">
              {syncingCount} Syncing
            </span>
            {degradedCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-[#F04438]/15 text-[#F04438] text-xs font-bold font-mono">
                {degradedCount} Degraded
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#98A2B3]">
            Block height: #1,849,302 (100% synchronized)
          </div>
        </div>
      </div>

      {/* 3. D3 CHARTS ROW (MAIN TIMELINE + TOPOLOGY MAP) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: D3 Real-time Sync Delay Line Chart (2/3 width) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#07101D]/80 border border-white/[0.08] backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-[#00CFFF]" />
                <span>Synchronization Delay &amp; Latency Real-time Stream</span>
              </h3>
              <p className="text-xs text-[#98A2B3]">
                D3 interactive time-series tracking synchronization delay (ms) vs maximum node drift.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Legend */}
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1.5 text-[#00CFFF]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00CFFF]" />
                  <span>Avg Delay</span>
                </span>
                <span className="flex items-center gap-1.5 text-[#F59E0B]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                  <span>Max Drift</span>
                </span>
              </div>
            </div>
          </div>

          {/* D3 SVG Container */}
          <div className="w-full overflow-hidden relative">
            <svg ref={timelineChartRef} className="w-full h-[260px]" />
          </div>
        </div>

        {/* Right Column: D3 Topology Network (1/3 width) */}
        <div className="p-5 rounded-2xl bg-[#07101D]/80 border border-white/[0.08] backdrop-blur-md space-y-4">
          <div className="border-b border-white/[0.06] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Share2 className="w-4 h-4 text-[#3B82F6]" />
              <span>Genesis Node Topology</span>
            </h3>
            <p className="text-xs text-[#98A2B3]">
              D3 force-directed cluster map connecting global regional nodes to hub.
            </p>
          </div>

          <div className="w-full overflow-hidden relative flex items-center justify-center">
            <svg ref={topologyChartRef} className="w-full h-[320px]" />
          </div>
        </div>

      </div>

      {/* 4. D3 HISTOGRAM + LIVE NODE MATRIX TABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Card: D3 Sync Delay Distribution Histogram */}
        <div className="p-5 rounded-2xl bg-[#07101D]/80 border border-white/[0.08] backdrop-blur-md space-y-4">
          <div className="border-b border-white/[0.06] pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#32D583]" />
              <span>Delay Distribution Bucket</span>
            </h3>
            <p className="text-xs text-[#98A2B3]">
              Node breakdown across latency ranges (ms).
            </p>
          </div>

          <div className="w-full overflow-hidden">
            <svg ref={distributionChartRef} className="w-full h-[180px]" />
          </div>
        </div>

        {/* Right Card: Filterable Genesis Node Table (2/3 width) */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#07101D]/80 border border-white/[0.08] backdrop-blur-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-[#00CFFF]" />
                <span>Active Genesis Nodes Connectivity Ledger</span>
              </h3>
              <p className="text-xs text-[#98A2B3]">
                Detailed state telemetry for all active Genesis Nodes.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Region Filter */}
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="bg-[#05070B] border border-white/[0.1] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Regions</option>
                {REGIONS.map((r) => (
                  <option key={r.code} value={r.name}>{r.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-[#05070B] border border-white/[0.1] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Status</option>
                <option value="ONLINE">Online</option>
                <option value="SYNCING">Syncing</option>
                <option value="DEGRADED">Degraded</option>
              </select>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
                <input
                  type="text"
                  placeholder="Filter Node ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#05070B] border border-white/[0.1] focus:border-[#00CFFF] rounded-lg pl-8 pr-3 py-1 text-xs text-white placeholder:text-white/20 focus:outline-none w-36"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] font-mono text-[#98A2B3] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Node ID</th>
                  <th className="py-2.5 px-3">Region</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Sync Delay</th>
                  <th className="py-2.5 px-3">Ping Latency</th>
                  <th className="py-2.5 px-3">Block Lag</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {filteredNodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#98A2B3]">
                      No active Genesis Nodes found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredNodes.slice(0, 8).map((node) => (
                    <tr
                      key={node.id}
                      onClick={() => setSelectedNode(node)}
                      className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-white flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00CFFF]" />
                        <span>{node.publicNodeId}</span>
                      </td>

                      <td className="py-2.5 px-3 text-[#98A2B3]">
                        {node.region}
                      </td>

                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            node.status === 'ONLINE'
                              ? 'bg-[#32D583]/15 text-[#32D583]'
                              : node.status === 'SYNCING'
                              ? 'bg-[#3B82F6]/15 text-[#3B82F6]'
                              : 'bg-[#F04438]/15 text-[#F04438]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              node.status === 'ONLINE'
                                ? 'bg-[#32D583]'
                                : node.status === 'SYNCING'
                                ? 'bg-[#3B82F6]'
                                : 'bg-[#F04438]'
                            }`}
                          />
                          <span>{node.status}</span>
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono font-bold text-white">
                        <span className={node.syncDelayMs > 60 ? 'text-[#F59E0B]' : 'text-[#32D583]'}>
                          {node.syncDelayMs} ms
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[#98A2B3]">
                        {node.pingMs} ms
                      </td>

                      <td className="py-2.5 px-3 font-mono text-[#98A2B3]">
                        {node.blockLag === 0 ? (
                          <span className="text-[#32D583]">Synced</span>
                        ) : (
                          <span className="text-[#F59E0B]">-{node.blockLag} blk</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestPing(node.publicNodeId);
                          }}
                          disabled={benchmarkNodeId === node.publicNodeId}
                          className="px-2.5 py-1 rounded bg-[#00CFFF]/10 hover:bg-[#00CFFF] hover:text-[#05070B] text-[#00CFFF] font-semibold text-[11px] transition-all cursor-pointer border border-[#00CFFF]/30 disabled:opacity-50"
                        >
                          {benchmarkNodeId === node.publicNodeId ? (
                            <RefreshCw className="w-3 h-3 animate-spin inline" />
                          ) : (
                            'Ping'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Benchmark Ping Modal/Banner if result available */}
          {benchmarkResult && (
            <div className="p-3 rounded-xl bg-[#32D583]/10 border border-[#32D583]/30 text-xs text-[#32D583] flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#32D583]" />
                <span>
                  Benchmark ping to <strong className="font-mono text-white">{benchmarkResult.node}</strong> verified: 
                  <strong className="font-mono text-white ml-1">{benchmarkResult.ping} ms latency</strong> (0% packet loss).
                </span>
              </div>
              <button
                onClick={() => setBenchmarkResult(null)}
                className="text-[#32D583] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>

      {/* 5. NODE DETAIL MODAL / DRAWER */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-[#07101D] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden font-sans space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00CFFF]/10 border border-[#00CFFF]/30 flex items-center justify-center text-[#00CFFF]">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">{selectedNode.publicNodeId}</h3>
                  <p className="text-xs text-[#98A2B3]">{selectedNode.region} ({selectedNode.regionCode})</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedNode(null)}
                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#98A2B3] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <span className="text-[#98A2B3] block text-[11px]">Status</span>
                <span className="font-bold text-[#32D583] font-mono">{selectedNode.status}</span>
              </div>

              <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <span className="text-[#98A2B3] block text-[11px]">Sync Delay</span>
                <span className="font-bold text-[#00CFFF] font-mono">{selectedNode.syncDelayMs} ms</span>
              </div>

              <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <span className="text-[#98A2B3] block text-[11px]">Ping Latency</span>
                <span className="font-bold text-white font-mono">{selectedNode.pingMs} ms</span>
              </div>

              <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <span className="text-[#98A2B3] block text-[11px]">Uptime SLA</span>
                <span className="font-bold text-[#32D583] font-mono">{selectedNode.uptimePct}%</span>
              </div>

              <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <span className="text-[#98A2B3] block text-[11px]">Active Peers</span>
                <span className="font-bold text-white font-mono">{selectedNode.peerCount} peers</span>
              </div>

              <div className="p-3 rounded-xl bg-[#05070B] border border-white/[0.06] space-y-1">
                <span className="text-[#98A2B3] block text-[11px]">IP Reference</span>
                <span className="font-bold text-white font-mono">{selectedNode.ipMasked}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setSelectedNode(null)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
