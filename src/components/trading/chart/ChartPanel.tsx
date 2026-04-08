'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  BarSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
  ColorType,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  BarData,
  HistogramData,
  LineData,
  AreaData,
  Time,
  DeepPartial,
  ChartOptions,
} from 'lightweight-charts';
import {
  BarChart3,
  Crosshair,
  MousePointer2,
  Minus,
  MoveVertical,
  GitCommitHorizontal,
  Type,
  Square,
  Ruler,
  ZoomIn,
  ZoomOut,
  Magnet,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import { formatPrice } from '@/lib/utils/format';
import type { OHLCVBuilder } from '@/lib/trading/ohlcv-builder';
import { TF_TO_RESOLUTION } from '@/lib/trading/ohlcv-builder';
import type { Resolution } from '@/lib/trading/ohlcv-builder';
import IndicatorPanel, {
  INDICATOR_DEFS,
  type IndicatorId,
} from './IndicatorPanel';
import ChartToolbar, { type ChartType, type LayoutType } from './ChartToolbar';
import {
  sma, ema, rsi, macd, bollingerBands, atr, stochastic, vwap,
  aroon, adx, donchianChannel, envelope, fractals, ichimoku,
  momentum, parabolicSAR, pivotPoints, bullsBearsPower,
} from '@/lib/trading/indicators';

// ─── Helpers ─────────────────────────────────────────────────────

const SYMBOL_DESCRIPTIONS: Record<string, string> = {
  EURUSD: 'Euro vs US Dollar', GBPUSD: 'British Pound vs US Dollar',
  USDJPY: 'US Dollar vs Japanese Yen', XAUUSD: 'Gold vs US Dollar',
  XAGUSD: 'Silver vs US Dollar', BTCUSD: 'Bitcoin vs US Dollar',
  ETHUSD: 'Ethereum vs US Dollar', US30: 'Dow Jones Industrial Average',
  NAS100: 'Nasdaq 100 Index', SPX500: 'S&P 500 Index',
  USDCHF: 'US Dollar vs Swiss Franc', AUDUSD: 'Australian Dollar vs US Dollar',
  NZDUSD: 'New Zealand Dollar vs US Dollar', USDCAD: 'US Dollar vs Canadian Dollar',
  EURJPY: 'Euro vs Japanese Yen', GBPJPY: 'British Pound vs Japanese Yen',
  EURGBP: 'Euro vs British Pound', USOIL: 'US Crude Oil',
  UKOIL: 'UK Brent Crude Oil', NATGAS: 'Natural Gas',
};

type DrawingToolId = 'cursor' | 'crosshair' | 'trendline' | 'horizontal' | 'vertical' | 'fibonacci' | 'text' | 'rectangle' | 'measure' | 'zoomin' | 'zoomout' | 'magnet' | 'lock' | 'visibility' | 'deleteall';

interface DrawingTool {
  id: DrawingToolId;
  label: string;
  icon: React.ReactNode;
  group: number;
  toggle?: boolean;
}

interface Drawing {
  type: string;
  startX: number; startY: number;
  endX: number; endY: number;
  color: string; text?: string;
}

const CANVAS_DRAWING_TOOLS: DrawingToolId[] = ['trendline', 'horizontal', 'vertical', 'fibonacci', 'text', 'rectangle', 'measure'];
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];

function getDecimals(symbol: string): number {
  if (['USDJPY', 'EURJPY', 'GBPJPY'].includes(symbol)) return 3;
  if (symbol.startsWith('XAU') || symbol.startsWith('ETH')) return 2;
  if (symbol === 'XAGUSD' || symbol === 'NATGAS') return 3;
  if (symbol.startsWith('BTC') || symbol === 'US30' || symbol === 'NAS100' || symbol === 'SPX500') return 1;
  if (symbol === 'USOIL' || symbol === 'UKOIL') return 2;
  return 5;
}

function ToolTooltip({ label, visible }: { label: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none whitespace-nowrap"
      style={{
        backgroundColor: '#1a1a28',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 4, padding: '4px 8px', fontSize: 11,
        color: 'rgba(255,255,255,0.85)',
        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      {label}
    </div>
  );
}

function renderDrawings(ctx: CanvasRenderingContext2D, drawings: Drawing[], w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
  for (const d of drawings) {
    ctx.strokeStyle = d.color; ctx.fillStyle = d.color;
    ctx.lineWidth = 1; ctx.setLineDash([]);
    switch (d.type) {
      case 'trendline':
        ctx.beginPath(); ctx.moveTo(d.startX, d.startY); ctx.lineTo(d.endX, d.endY); ctx.stroke(); break;
      case 'horizontal':
        ctx.setLineDash([6,3]); ctx.beginPath(); ctx.moveTo(0, d.startY); ctx.lineTo(w, d.startY); ctx.stroke(); ctx.setLineDash([]); break;
      case 'vertical':
        ctx.setLineDash([6,3]); ctx.beginPath(); ctx.moveTo(d.startX, 0); ctx.lineTo(d.startX, h); ctx.stroke(); ctx.setLineDash([]); break;
      case 'rectangle':
        ctx.strokeRect(d.startX, d.startY, d.endX - d.startX, d.endY - d.startY); break;
      case 'fibonacci': {
        const top = Math.min(d.startY, d.endY), bottom = Math.max(d.startY, d.endY), range = bottom - top;
        ctx.font = '10px JetBrains Mono, monospace';
        for (const level of FIB_LEVELS) {
          const y = bottom - level * range;
          ctx.setLineDash(level === 0 || level === 1 ? [] : [4,3]);
          ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(d.startX, y); ctx.lineTo(d.endX, y); ctx.stroke(); ctx.globalAlpha = 1;
          ctx.fillText(`${(level*100).toFixed(1)}%`, d.endX + 4, y + 3);
        }
        ctx.setLineDash([]); break;
      }
      case 'measure': {
        ctx.setLineDash([3,3]); ctx.beginPath(); ctx.moveTo(d.startX, d.startY); ctx.lineTo(d.endX, d.endY); ctx.stroke(); ctx.setLineDash([]);
        const dx = d.endX - d.startX, dy = d.endY - d.startY;
        ctx.font = '11px JetBrains Mono, monospace'; ctx.fillStyle = '#fff';
        ctx.fillText(`${Math.sqrt(dx*dx+dy*dy).toFixed(0)}px`, (d.startX+d.endX)/2+6, (d.startY+d.endY)/2-6); break;
      }
      case 'text':
        if (d.text) { ctx.font = '13px JetBrains Mono, monospace'; ctx.fillText(d.text, d.startX, d.startY); } break;
    }
  }
}

// ─── Indicator Colors ─────────────────────────────────────────────

const INDICATOR_COLORS: Record<string, string> = {
  sma9: '#FFFF00', sma21: '#00FFFF', sma50: '#FFA500', sma200: '#FFFFFF',
  ema9: '#FF6B6B', ema21: '#4ECDC4', ema50: '#FFE66D', vwap: '#E040FB',
  bbands_upper: 'rgba(41,171,226,0.5)', bbands_middle: 'rgba(41,171,226,0.3)', bbands_lower: 'rgba(41,171,226,0.5)',
  rsi14: '#FF9800',
  macd_macd: '#2196F3', macd_signal: '#FF5722', macd_hist_pos: 'rgba(0,194,122,0.4)', macd_hist_neg: 'rgba(193,18,31,0.4)',
  atr14: '#AB47BC',
  stoch_k: '#2196F3', stoch_d: '#FF5722',
  // Extended
  aroon_up: '#00C27A', aroon_down: '#C1121F',
  adx_adx: '#FF9800', adx_plus: '#00C27A', adx_minus: '#C1121F',
  donchian_upper: '#00BCD4', donchian_middle: 'rgba(0,188,212,0.4)', donchian_lower: '#00BCD4',
  envelope_upper: '#AB47BC', envelope_basis: 'rgba(171,71,188,0.4)', envelope_lower: '#AB47BC',
  fractals_up: '#00C27A', fractals_down: '#C1121F',
  ichimoku_conversion: '#0091D5', ichimoku_base: '#FF5722', ichimoku_spanA: 'rgba(0,194,122,0.3)', ichimoku_spanB: 'rgba(193,18,31,0.3)', ichimoku_lagging: '#E040FB',
  momentum: '#FF9800', psar: '#E040FB',
  pp_pivot: '#FFD700', pp_r1: '#00C27A', pp_r2: 'rgba(0,194,122,0.5)', pp_r3: 'rgba(0,194,122,0.3)',
  pp_s1: '#C1121F', pp_s2: 'rgba(193,18,31,0.5)', pp_s3: 'rgba(193,18,31,0.3)',
  bullsbears_bulls: '#00C27A', bullsbears_bears: '#C1121F',
};

// ─── Main Component ────────────────────────────────────────────────

interface ChartPanelProps {
  ohlcvBuilder: OHLCVBuilder | null;
  isLiveData?: boolean;
}

export default function ChartPanel({ ohlcvBuilder, isLiveData = false }: ChartPanelProps) {
  const { activeSymbol, prices } = useTradingStore();
  const [selectedTf, setSelectedTf] = useState<string>('1H');
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [oneClickTrading, setOneClickTrading] = useState(false);
  const [activeLayout, setActiveLayout] = useState<LayoutType>('single');

  // Listen for keyboard tf changes
  useEffect(() => {
    const TF_MAP: Record<string, string> = { '1':'1m','2':'5m','3':'15m','4':'1H','5':'4H','6':'1D' };
    function handleTfChange(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (detail && Object.values(TF_MAP).includes(detail)) setSelectedTf(detail);
    }
    window.addEventListener('raptor-timeframe-change', handleTfChange);
    return () => window.removeEventListener('raptor-timeframe-change', handleTfChange);
  }, []);

  // Indicator state
  const [showIndicatorPanel, setShowIndicatorPanel] = useState(false);
  const [activeIndicators, setActiveIndicators] = useState<Set<IndicatorId>>(new Set());
  const [indicatorParams, setIndicatorParams] = useState<Record<IndicatorId, Record<string, number>>>({} as Record<IndicatorId, Record<string, number>>);

  // Drawing tools state
  const [activeTool, setActiveTool] = useState<DrawingToolId>('cursor');
  const [magnetMode, setMagnetMode] = useState(false);
  const [lockDrawings, setLockDrawings] = useState(false);
  const [showDrawings, setShowDrawings] = useState(true);
  const [hoveredTool, setHoveredTool] = useState<DrawingToolId | null>(null);

  // Canvas drawing state
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [previewEnd, setPreviewEnd] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const customPriceLinesRef = useRef<Array<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>>>([]);

  // OHLC overlay
  const [ohlcValues, setOhlcValues] = useState<{ open: number; high: number; low: number; close: number; } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const barSeriesRef = useRef<ISeriesApi<'Bar'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null);
  const lastBarTimeRef = useRef<number>(0);
  const lastCrosshairPriceRef = useRef<number | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'> | ISeriesApi<'Histogram'>>>(new Map());

  // ─── Indicator handlers ──────────────────────────

  const handleIndicatorToggle = useCallback((id: IndicatorId) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleIndicatorParamsUpdate = useCallback((id: IndicatorId, params: Record<string, number>) => {
    setIndicatorParams((prev) => ({ ...prev, [id]: params }));
  }, []);

  // ─── Clear All ───────────────────────────────────

  const handleClearAll = useCallback(() => {
    // Clear indicators
    setActiveIndicators(new Set());
    // Clean up indicator series from chart
    const chart = chartRef.current;
    if (chart) {
      for (const [, series] of indicatorSeriesRef.current.entries()) {
        try { chart.removeSeries(series); } catch { /* noop */ }
      }
      indicatorSeriesRef.current.clear();
    }
    // Clear drawings
    setDrawings([]);
    for (const pl of customPriceLinesRef.current) {
      try { candleSeriesRef.current?.removePriceLine(pl); } catch { /* noop */ }
    }
    customPriceLinesRef.current = [];
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, []);

  // ─── Drawing tools config ────────────────────────

  const drawingTools: DrawingTool[] = [
    { id: 'cursor', label: 'Pointer', icon: <MousePointer2 size={18} />, group: 1 },
    { id: 'crosshair', label: 'Crosshair', icon: <Crosshair size={18} />, group: 1 },
    { id: 'trendline', label: 'Trend Line', icon: <TrendingUp size={18} />, group: 2 },
    { id: 'horizontal', label: 'Horizontal Line', icon: <Minus size={18} />, group: 2 },
    { id: 'vertical', label: 'Vertical Line', icon: <MoveVertical size={18} />, group: 2 },
    { id: 'fibonacci', label: 'Fibonacci', icon: <GitCommitHorizontal size={18} />, group: 3 },
    { id: 'text', label: 'Text', icon: <Type size={18} />, group: 3 },
    { id: 'rectangle', label: 'Rectangle', icon: <Square size={18} />, group: 3 },
    { id: 'measure', label: 'Measure', icon: <Ruler size={18} />, group: 4 },
    { id: 'zoomin', label: 'Zoom In', icon: <ZoomIn size={18} />, group: 4 },
    { id: 'zoomout', label: 'Zoom Out', icon: <ZoomOut size={18} />, group: 4 },
    { id: 'magnet', label: 'Magnet Mode', icon: <Magnet size={18} />, group: 5, toggle: true },
    { id: 'lock', label: 'Lock Drawings', icon: <Lock size={18} />, group: 5, toggle: true },
    { id: 'visibility', label: showDrawings ? 'Hide Drawings' : 'Show Drawings', icon: showDrawings ? <Eye size={18} /> : <EyeOff size={18} />, group: 5, toggle: true },
    { id: 'deleteall', label: 'Delete All Drawings', icon: <Trash2 size={18} />, group: 6, toggle: true },
  ];

  const handleToolClick = (tool: DrawingTool) => {
    if (tool.id === 'magnet') { setMagnetMode(!magnetMode); }
    else if (tool.id === 'lock') { setLockDrawings(!lockDrawings); }
    else if (tool.id === 'visibility') { setShowDrawings(!showDrawings); }
    else if (tool.id === 'deleteall') {
      setDrawings([]);
      for (const pl of customPriceLinesRef.current) { try { candleSeriesRef.current?.removePriceLine(pl); } catch {} }
      customPriceLinesRef.current = [];
      if (canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); }
    } else if (tool.id === 'zoomin') {
      chartRef.current?.timeScale().applyOptions({ barSpacing: (chartRef.current.timeScale().options().barSpacing ?? 8) + 2 });
    } else if (tool.id === 'zoomout') {
      const current = chartRef.current?.timeScale().options().barSpacing ?? 8;
      chartRef.current?.timeScale().applyOptions({ barSpacing: Math.max(2, current - 2) });
    } else { setActiveTool(tool.id); }
  };

  const isToolActive = (tool: DrawingTool): boolean => {
    if (tool.id === 'magnet') return magnetMode;
    if (tool.id === 'lock') return lockDrawings;
    if (tool.id === 'visibility') return !showDrawings;
    if (tool.id === 'deleteall' || tool.id === 'zoomin' || tool.id === 'zoomout') return false;
    return activeTool === tool.id;
  };

  // ─── Canvas drawing handlers ─────────────────────

  const handleDrawStart = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (lockDrawings) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;

    if (activeTool === 'text') {
      const text = prompt('Enter text:');
      if (text) setDrawings((prev) => [...prev, { type: 'text', startX: x, startY: y, endX: x, endY: y, color: '#0091D5', text }]);
      return;
    }
    if (activeTool === 'vertical') {
      setDrawings((prev) => [...prev, { type: 'vertical', startX: x, startY: y, endX: x, endY: y, color: '#0091D5' }]);
      return;
    }
    if (activeTool === 'horizontal') {
      setDrawings((prev) => [...prev, { type: 'horizontal', startX: x, startY: y, endX: x, endY: y, color: '#0091D5' }]);
      if (lastCrosshairPriceRef.current !== null && candleSeriesRef.current) {
        const pl = candleSeriesRef.current.createPriceLine({ price: lastCrosshairPriceRef.current, color: '#0091D5', lineWidth: 1 as const, lineStyle: LineStyle.Dotted, lineVisible: true, axisLabelVisible: true, axisLabelColor: '#0091D5', axisLabelTextColor: '#ffffff' });
        customPriceLinesRef.current.push(pl);
      }
      return;
    }
    setDrawStart({ x, y }); setIsDrawing(true);
  }, [activeTool, lockDrawings]);

  const handleDrawMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setPreviewEnd({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [isDrawing, drawStart]);

  const handleDrawEnd = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    setDrawings((prev) => [...prev, { type: activeTool, startX: drawStart.x, startY: drawStart.y, endX: x, endY: y, color: '#0091D5' }]);
    setIsDrawing(false); setDrawStart(null); setPreviewEnd(null);
  }, [isDrawing, drawStart, activeTool]);

  // Repaint canvas
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    if (!showDrawings) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    renderDrawings(ctx, drawings, canvas.width, canvas.height);
    if (isDrawing && drawStart && previewEnd) {
      ctx.strokeStyle = 'rgba(41,171,226,0.6)'; ctx.fillStyle = 'rgba(41,171,226,0.6)';
      ctx.lineWidth = 1; ctx.setLineDash([4,4]);
      switch (activeTool) {
        case 'trendline': case 'measure':
          ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y); ctx.lineTo(previewEnd.x, previewEnd.y); ctx.stroke();
          if (activeTool === 'measure') { const dx=previewEnd.x-drawStart.x, dy=previewEnd.y-drawStart.y; ctx.font='11px JetBrains Mono, monospace'; ctx.fillStyle='#fff'; ctx.setLineDash([]); ctx.fillText(`${Math.sqrt(dx*dx+dy*dy).toFixed(0)}px`,(drawStart.x+previewEnd.x)/2+6,(drawStart.y+previewEnd.y)/2-6); }
          break;
        case 'rectangle': ctx.strokeRect(drawStart.x, drawStart.y, previewEnd.x - drawStart.x, previewEnd.y - drawStart.y); break;
        case 'fibonacci': {
          const top=Math.min(drawStart.y,previewEnd.y), bottom=Math.max(drawStart.y,previewEnd.y), range=bottom-top;
          ctx.font='10px JetBrains Mono, monospace';
          for (const level of FIB_LEVELS) { const y=bottom-level*range; ctx.beginPath(); ctx.moveTo(drawStart.x, y); ctx.lineTo(previewEnd.x, y); ctx.stroke(); }
          break;
        }
      }
      ctx.setLineDash([]);
    }
  }, [drawings, isDrawing, drawStart, previewEnd, showDrawings, activeTool]);

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current; const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const syncSize = () => {
      const { width, height } = parent.getBoundingClientRect();
      canvas.width = width; canvas.height = height;
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx && showDrawings) renderDrawings(ctx, drawings, canvas.width, canvas.height);
    };
    syncSize();
    const ro = new ResizeObserver(syncSize); ro.observe(parent);
    return () => ro.disconnect();
  }, [drawings, showDrawings]);

  // ─── Create chart ────────────────────────────────

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions: DeepPartial<ChartOptions> = {
      layout: { background: { type: ColorType.Solid, color: '#060D16' }, textColor: 'rgba(255,255,255,0.5)', fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace", fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(41,171,226,0.4)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0091D5' },
        horzLine: { color: 'rgba(41,171,226,0.4)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0091D5' },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true, secondsVisible: false, rightOffset: 5, barSpacing: 8 },
      handleScroll: true, handleScale: true,
    };

    const chart = createChart(chartContainerRef.current, chartOptions);
    chartRef.current = chart;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) { setOhlcValues(null); return; }
      const candleData = param.seriesData.get(candleSeriesRef.current!) as CandlestickData | undefined;
      if (candleData && 'open' in candleData) {
        setOhlcValues({ open: candleData.open, high: candleData.high, low: candleData.low, close: candleData.close });
      }
      if (param.point) {
        const price = candleSeriesRef.current?.coordinateToPrice(param.point.y);
        if (price !== null && price !== undefined) lastCrosshairPriceRef.current = price;
      }
    });

    // Create all 4 series types
    const candleSeries = chart.addSeries(CandlestickSeries, { upColor: '#00C27A', downColor: '#C1121F', borderUpColor: '#00C27A', borderDownColor: '#C1121F', wickUpColor: '#00C27A', wickDownColor: '#C1121F' });
    candleSeriesRef.current = candleSeries;

    const barSer = chart.addSeries(BarSeries, { upColor: '#00C27A', downColor: '#C1121F', visible: false });
    barSeriesRef.current = barSer;

    const lineSer = chart.addSeries(LineSeries, { color: '#0091D5', lineWidth: 2, visible: false });
    lineSeriesRef.current = lineSer;

    const areaSer = chart.addSeries(AreaSeries, {
      topColor: 'rgba(0,145,213,0.3)', bottomColor: 'rgba(0,145,213,0.02)',
      lineColor: '#0091D5', lineWidth: 2, visible: false,
    });
    areaSeriesRef.current = areaSer;

    const volumeSeries = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume' });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) { const { width, height } = entry.contentRect; chart.applyOptions({ width, height }); }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      indicatorSeriesRef.current.clear();
      chart.remove();
      chartRef.current = null; candleSeriesRef.current = null; barSeriesRef.current = null;
      lineSeriesRef.current = null; areaSeriesRef.current = null; volumeSeriesRef.current = null;
      priceLineRef.current = null;
    };
  }, []);

  // Toggle chart type visibility
  useEffect(() => {
    candleSeriesRef.current?.applyOptions({ visible: chartType === 'candlestick' });
    barSeriesRef.current?.applyOptions({ visible: chartType === 'bar' });
    lineSeriesRef.current?.applyOptions({ visible: chartType === 'line' });
    areaSeriesRef.current?.applyOptions({ visible: chartType === 'area' });
  }, [chartType]);

  // ─── Indicator series helpers ────────────────────

  const getOrCreateLineSeries = useCallback((key: string, color: string, scaleId?: string, lineWidth: number = 1): ISeriesApi<'Line'> => {
    const existing = indicatorSeriesRef.current.get(key);
    if (existing) return existing as ISeriesApi<'Line'>;
    const chart = chartRef.current; if (!chart) throw new Error('Chart not initialized');
    const series = chart.addSeries(LineSeries, { color, lineWidth: lineWidth as 1|2|3|4, priceScaleId: scaleId || 'right', lastValueVisible: false, priceLineVisible: false });
    if (scaleId && scaleId !== 'right') series.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    indicatorSeriesRef.current.set(key, series);
    return series;
  }, []);

  const getOrCreateHistSeries = useCallback((key: string, scaleId: string): ISeriesApi<'Histogram'> => {
    const existing = indicatorSeriesRef.current.get(key);
    if (existing) return existing as ISeriesApi<'Histogram'>;
    const chart = chartRef.current; if (!chart) throw new Error('Chart not initialized');
    const series = chart.addSeries(HistogramSeries, { priceScaleId: scaleId, lastValueVisible: false, priceLineVisible: false });
    series.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
    indicatorSeriesRef.current.set(key, series);
    return series;
  }, []);

  const cleanupIndicatorSeries = useCallback(() => {
    const chart = chartRef.current; if (!chart) return;
    const activeKeys = new Set<string>();
    for (const id of activeIndicators) {
      if (id === 'bbands') { activeKeys.add('bbands_upper'); activeKeys.add('bbands_middle'); activeKeys.add('bbands_lower'); }
      else if (id === 'macd') { activeKeys.add('macd_macd'); activeKeys.add('macd_signal'); activeKeys.add('macd_hist'); }
      else if (id === 'stoch') { activeKeys.add('stoch_k'); activeKeys.add('stoch_d'); }
      else if (id === 'aroon') { activeKeys.add('aroon_up'); activeKeys.add('aroon_down'); }
      else if (id === 'adx') { activeKeys.add('adx_adx'); activeKeys.add('adx_plus'); activeKeys.add('adx_minus'); }
      else if (id === 'donchian') { activeKeys.add('donchian_upper'); activeKeys.add('donchian_middle'); activeKeys.add('donchian_lower'); }
      else if (id === 'envelope') { activeKeys.add('envelope_upper'); activeKeys.add('envelope_basis'); activeKeys.add('envelope_lower'); }
      else if (id === 'fractals') { activeKeys.add('fractals_up'); activeKeys.add('fractals_down'); }
      else if (id === 'ichimoku') { activeKeys.add('ichimoku_conversion'); activeKeys.add('ichimoku_base'); activeKeys.add('ichimoku_spanA'); activeKeys.add('ichimoku_spanB'); activeKeys.add('ichimoku_lagging'); }
      else if (id === 'pivotpoints') { activeKeys.add('pp_pivot'); activeKeys.add('pp_r1'); activeKeys.add('pp_r2'); activeKeys.add('pp_r3'); activeKeys.add('pp_s1'); activeKeys.add('pp_s2'); activeKeys.add('pp_s3'); }
      else if (id === 'bullsbears') { activeKeys.add('bullsbears_bulls'); activeKeys.add('bullsbears_bears'); }
      else { activeKeys.add(id); }
    }
    for (const [key, series] of indicatorSeriesRef.current.entries()) {
      if (!activeKeys.has(key)) { try { chart.removeSeries(series); } catch {} indicatorSeriesRef.current.delete(key); }
    }
  }, [activeIndicators]);

  // ─── Apply indicators ────────────────────────────

  const applyIndicators = useCallback((times: Time[], closes: number[], highs: number[], lows: number[], volumes: number[]) => {
    if (!chartRef.current || times.length === 0) return;
    cleanupIndicatorSeries();

    const toLineData = (values: (number | null)[]): LineData[] => {
      const data: LineData[] = [];
      for (let i = 0; i < values.length; i++) { if (values[i] !== null) data.push({ time: times[i], value: values[i]! }); }
      return data;
    };

    for (const id of activeIndicators) {
      const def = INDICATOR_DEFS.find((d) => d.id === id); if (!def) continue;
      const params = indicatorParams[id] || def.defaultParams;
      try {
        switch (id) {
          case 'sma9': case 'sma21': case 'sma50': case 'sma200': {
            const values = sma(closes, params.period || def.defaultParams.period);
            getOrCreateLineSeries(id, INDICATOR_COLORS[id]).setData(toLineData(values)); break;
          }
          case 'ema9': case 'ema21': case 'ema50': {
            const values = ema(closes, params.period || def.defaultParams.period);
            getOrCreateLineSeries(id, INDICATOR_COLORS[id]).setData(toLineData(values)); break;
          }
          case 'vwap': {
            const values = vwap(highs, lows, closes, volumes);
            getOrCreateLineSeries(id, INDICATOR_COLORS[id]).setData(values.map((v, i) => ({ time: times[i], value: v }))); break;
          }
          case 'bbands': {
            const bb = bollingerBands(closes, params.period || 20, params.stdDev || 2);
            getOrCreateLineSeries('bbands_upper', INDICATOR_COLORS.bbands_upper).setData(toLineData(bb.upper));
            getOrCreateLineSeries('bbands_middle', INDICATOR_COLORS.bbands_middle).setData(toLineData(bb.middle));
            getOrCreateLineSeries('bbands_lower', INDICATOR_COLORS.bbands_lower).setData(toLineData(bb.lower)); break;
          }
          case 'rsi14': {
            const s = getOrCreateLineSeries(id, INDICATOR_COLORS[id], 'rsi');
            s.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
            s.setData(toLineData(rsi(closes, params.period || 14))); break;
          }
          case 'macd': {
            const m = macd(closes, params.fast || 12, params.slow || 26, params.signal || 9);
            const ms = getOrCreateLineSeries('macd_macd', INDICATOR_COLORS.macd_macd, 'macd');
            ms.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
            ms.setData(toLineData(m.macd));
            getOrCreateLineSeries('macd_signal', INDICATOR_COLORS.macd_signal, 'macd').setData(toLineData(m.signal));
            const histData: HistogramData[] = [];
            for (let i = 0; i < m.histogram.length; i++) { if (m.histogram[i] !== null) histData.push({ time: times[i], value: m.histogram[i]!, color: m.histogram[i]! >= 0 ? INDICATOR_COLORS.macd_hist_pos : INDICATOR_COLORS.macd_hist_neg }); }
            getOrCreateHistSeries('macd_hist', 'macd').setData(histData); break;
          }
          case 'atr14': {
            const s = getOrCreateLineSeries(id, INDICATOR_COLORS[id], 'atr');
            s.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
            s.setData(toLineData(atr(highs, lows, closes, params.period || 14))); break;
          }
          case 'stoch': {
            const st = stochastic(highs, lows, closes, params.kPeriod || 14, params.dPeriod || 3);
            const ks = getOrCreateLineSeries('stoch_k', INDICATOR_COLORS.stoch_k, 'stoch');
            ks.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
            ks.setData(toLineData(st.k));
            getOrCreateLineSeries('stoch_d', INDICATOR_COLORS.stoch_d, 'stoch').setData(toLineData(st.d)); break;
          }
          // ─── Extended Indicators ───────────────────
          case 'aroon': {
            const a = aroon(highs, lows, params.period || 25);
            const us = getOrCreateLineSeries('aroon_up', INDICATOR_COLORS.aroon_up, 'aroon');
            us.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
            us.setData(toLineData(a.up));
            getOrCreateLineSeries('aroon_down', INDICATOR_COLORS.aroon_down, 'aroon').setData(toLineData(a.down)); break;
          }
          case 'adx': {
            const a = adx(highs, lows, closes, params.period || 14);
            const as2 = getOrCreateLineSeries('adx_adx', INDICATOR_COLORS.adx_adx, 'adx');
            as2.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
            as2.setData(toLineData(a.adx));
            getOrCreateLineSeries('adx_plus', INDICATOR_COLORS.adx_plus, 'adx').setData(toLineData(a.plusDI));
            getOrCreateLineSeries('adx_minus', INDICATOR_COLORS.adx_minus, 'adx').setData(toLineData(a.minusDI)); break;
          }
          case 'donchian': {
            const dc = donchianChannel(highs, lows, params.period || 20);
            getOrCreateLineSeries('donchian_upper', INDICATOR_COLORS.donchian_upper).setData(toLineData(dc.upper));
            getOrCreateLineSeries('donchian_middle', INDICATOR_COLORS.donchian_middle).setData(toLineData(dc.middle));
            getOrCreateLineSeries('donchian_lower', INDICATOR_COLORS.donchian_lower).setData(toLineData(dc.lower)); break;
          }
          case 'envelope': {
            const env = envelope(closes, params.period || 20, params.percent || 2.5);
            getOrCreateLineSeries('envelope_upper', INDICATOR_COLORS.envelope_upper).setData(toLineData(env.upper));
            getOrCreateLineSeries('envelope_basis', INDICATOR_COLORS.envelope_basis).setData(toLineData(env.basis));
            getOrCreateLineSeries('envelope_lower', INDICATOR_COLORS.envelope_lower).setData(toLineData(env.lower)); break;
          }
          case 'fractals': {
            const f = fractals(highs, lows);
            getOrCreateLineSeries('fractals_up', INDICATOR_COLORS.fractals_up).setData(toLineData(f.up));
            getOrCreateLineSeries('fractals_down', INDICATOR_COLORS.fractals_down).setData(toLineData(f.down)); break;
          }
          case 'ichimoku': {
            const ic = ichimoku(highs, lows, closes, params.conversion || 9, params.base || 26, params.spanB || 52, params.displacement || 26);
            getOrCreateLineSeries('ichimoku_conversion', INDICATOR_COLORS.ichimoku_conversion).setData(toLineData(ic.conversion));
            getOrCreateLineSeries('ichimoku_base', INDICATOR_COLORS.ichimoku_base).setData(toLineData(ic.base));
            getOrCreateLineSeries('ichimoku_spanA', INDICATOR_COLORS.ichimoku_spanA).setData(toLineData(ic.spanA));
            getOrCreateLineSeries('ichimoku_spanB', INDICATOR_COLORS.ichimoku_spanB).setData(toLineData(ic.spanB));
            getOrCreateLineSeries('ichimoku_lagging', INDICATOR_COLORS.ichimoku_lagging).setData(toLineData(ic.lagging)); break;
          }
          case 'momentum': {
            const s = getOrCreateLineSeries('momentum', INDICATOR_COLORS.momentum, 'mom');
            s.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
            s.setData(toLineData(momentum(closes, params.period || 10))); break;
          }
          case 'psar': {
            getOrCreateLineSeries('psar', INDICATOR_COLORS.psar).setData(toLineData(parabolicSAR(highs, lows, params.step || 0.02, params.max || 0.2))); break;
          }
          case 'pivotpoints': {
            const pp = pivotPoints(highs, lows, closes);
            getOrCreateLineSeries('pp_pivot', INDICATOR_COLORS.pp_pivot).setData(toLineData(pp.pivot));
            getOrCreateLineSeries('pp_r1', INDICATOR_COLORS.pp_r1).setData(toLineData(pp.r1));
            getOrCreateLineSeries('pp_r2', INDICATOR_COLORS.pp_r2).setData(toLineData(pp.r2));
            getOrCreateLineSeries('pp_r3', INDICATOR_COLORS.pp_r3).setData(toLineData(pp.r3));
            getOrCreateLineSeries('pp_s1', INDICATOR_COLORS.pp_s1).setData(toLineData(pp.s1));
            getOrCreateLineSeries('pp_s2', INDICATOR_COLORS.pp_s2).setData(toLineData(pp.s2));
            getOrCreateLineSeries('pp_s3', INDICATOR_COLORS.pp_s3).setData(toLineData(pp.s3)); break;
          }
          case 'bullsbears': {
            const bb2 = bullsBearsPower(highs, lows, closes, params.period || 13);
            const bullsHist: HistogramData[] = [];
            const bearsHist: HistogramData[] = [];
            for (let i = 0; i < bb2.bulls.length; i++) {
              if (bb2.bulls[i] !== null) bullsHist.push({ time: times[i], value: bb2.bulls[i]!, color: INDICATOR_COLORS.bullsbears_bulls });
              if (bb2.bears[i] !== null) bearsHist.push({ time: times[i], value: bb2.bears[i]!, color: INDICATOR_COLORS.bullsbears_bears });
            }
            const bs = getOrCreateHistSeries('bullsbears_bulls', 'bbp');
            bs.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
            bs.setData(bullsHist);
            getOrCreateHistSeries('bullsbears_bears', 'bbp').setData(bearsHist); break;
          }
        }
      } catch { /* skip */ }
    }
  }, [activeIndicators, indicatorParams, cleanupIndicatorSeries, getOrCreateLineSeries, getOrCreateHistSeries]);

  // ─── Load chart data ─────────────────────────────

  const loadChartData = useCallback(() => {
    if (!ohlcvBuilder || !candleSeriesRef.current || !barSeriesRef.current || !lineSeriesRef.current || !areaSeriesRef.current || !volumeSeriesRef.current) return;
    const resolution = TF_TO_RESOLUTION[selectedTf] as Resolution;
    if (!resolution) return;
    const allBars = ohlcvBuilder.getAllBars(activeSymbol, resolution);
    if (allBars.length === 0) return;

    const candleData: CandlestickData[] = allBars.map((bar) => ({ time: bar.time as Time, open: bar.open, high: bar.high, low: bar.low, close: bar.close }));
    const barData: BarData[] = allBars.map((bar) => ({ time: bar.time as Time, open: bar.open, high: bar.high, low: bar.low, close: bar.close }));
    const lineData: LineData[] = allBars.map((bar) => ({ time: bar.time as Time, value: bar.close }));
    const areaData: AreaData[] = allBars.map((bar) => ({ time: bar.time as Time, value: bar.close }));
    const volumeData: HistogramData[] = allBars.map((bar) => ({ time: bar.time as Time, value: bar.volume, color: bar.close >= bar.open ? 'rgba(0,194,122,0.15)' : 'rgba(193,18,31,0.15)' }));

    candleSeriesRef.current.setData(candleData);
    barSeriesRef.current.setData(barData);
    lineSeriesRef.current.setData(lineData);
    areaSeriesRef.current.setData(areaData);
    volumeSeriesRef.current.setData(volumeData);

    lastBarTimeRef.current = allBars[allBars.length - 1].time;

    // Price line
    if (priceLineRef.current && candleSeriesRef.current) { try { candleSeriesRef.current.removePriceLine(priceLineRef.current); } catch {} }
    const lastPrice = allBars[allBars.length - 1].close;
    priceLineRef.current = candleSeriesRef.current.createPriceLine({ price: lastPrice, color: '#0091D5', lineWidth: 1 as const, lineStyle: LineStyle.Dotted, lineVisible: true, axisLabelVisible: true, axisLabelColor: '#0091D5', axisLabelTextColor: '#ffffff' });

    // Apply indicators
    const times = allBars.map((b) => b.time as Time);
    const closes = allBars.map((b) => b.close);
    const highs = allBars.map((b) => b.high);
    const lows = allBars.map((b) => b.low);
    const volumes = allBars.map((b) => b.volume);
    applyIndicators(times, closes, highs, lows, volumes);

    chartRef.current?.timeScale().scrollToRealTime();
  }, [activeSymbol, selectedTf, ohlcvBuilder, applyIndicators]);

  useEffect(() => { loadChartData(); }, [loadChartData]);

  // Live tick updates
  useEffect(() => {
    if (!ohlcvBuilder || !candleSeriesRef.current || !barSeriesRef.current || !lineSeriesRef.current || !areaSeriesRef.current || !volumeSeriesRef.current) return;
    const resolution = TF_TO_RESOLUTION[selectedTf] as Resolution; if (!resolution) return;
    const tick = prices[activeSymbol]; if (!tick) return;
    const currentBar = ohlcvBuilder.getCurrentBar(activeSymbol, resolution); if (!currentBar) return;

    if (currentBar.time > lastBarTimeRef.current) { loadChartData(); }
    else {
      const t = currentBar.time as Time;
      candleSeriesRef.current.update({ time: t, open: currentBar.open, high: currentBar.high, low: currentBar.low, close: currentBar.close });
      barSeriesRef.current.update({ time: t, open: currentBar.open, high: currentBar.high, low: currentBar.low, close: currentBar.close });
      lineSeriesRef.current.update({ time: t, value: currentBar.close });
      areaSeriesRef.current.update({ time: t, value: currentBar.close });
      volumeSeriesRef.current.update({ time: t, value: currentBar.volume, color: currentBar.close >= currentBar.open ? 'rgba(0,194,122,0.15)' : 'rgba(193,18,31,0.15)' });
    }

    if (priceLineRef.current) priceLineRef.current.applyOptions({ price: tick.mid });
  }, [prices, activeSymbol, selectedTf, ohlcvBuilder, loadChartData]);

  // ─── Display values ──────────────────────────────

  const currentTick = prices[activeSymbol];
  const decimals = getDecimals(activeSymbol);
  const displayOhlc = ohlcValues || (currentTick ? { open: currentTick.mid, high: currentTick.mid, low: currentTick.mid, close: currentTick.mid } : null);
  const canvasActive = CANVAS_DRAWING_TOOLS.includes(activeTool) && !lockDrawings;

  // Render drawing tools sidebar
  const renderToolsWithSeparators = () => {
    const elements: React.ReactNode[] = [];
    let lastGroup = 0;
    drawingTools.forEach((tool) => {
      if (tool.group !== lastGroup && lastGroup !== 0) {
        elements.push(<div key={`sep-${tool.group}`} className="w-full my-1" style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginLeft: 4, marginRight: 4, width: 'calc(100% - 8px)' }} />);
      }
      lastGroup = tool.group;
      const active = isToolActive(tool);
      elements.push(
        <div key={tool.id} className="relative flex items-center justify-center">
          <button
            onClick={() => handleToolClick(tool)}
            onMouseEnter={() => setHoveredTool(tool.id)}
            onMouseLeave={() => setHoveredTool(null)}
            className="flex items-center justify-center transition-all duration-150"
            style={{ width: 30, height: 30, borderRadius: 4, backgroundColor: active ? 'rgba(41,171,226,0.15)' : 'transparent', color: active ? '#0091D5' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
            onMouseOver={(e) => { if (!active) { e.currentTarget.style.color = 'rgba(255,255,255,1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; } }}
            onMouseOut={(e) => { if (!active) { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.backgroundColor = 'transparent'; } }}
          >
            {tool.icon}
          </button>
          <ToolTooltip label={tool.label} visible={hoveredTool === tool.id} />
        </div>
      );
    });
    return elements;
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Enhanced Chart Toolbar */}
      <ChartToolbar
        selectedTf={selectedTf}
        onTfChange={setSelectedTf}
        chartType={chartType}
        onChartTypeChange={setChartType}
        oneClickTrading={oneClickTrading}
        onOneClickTradingToggle={() => setOneClickTrading(!oneClickTrading)}
        activeIndicators={activeIndicators}
        onShowIndicators={() => setShowIndicatorPanel(!showIndicatorPanel)}
        onClearAll={handleClearAll}
        activeLayout={activeLayout}
        onLayoutChange={setActiveLayout}
      />

      {/* Symbol & OHLC info bar */}
      <div
        className="flex items-center gap-2 px-3 border-b shrink-0"
        style={{ height: 32, minHeight: 32, backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
      >
        <div className="w-2 h-2 rounded-full mr-1 shrink-0" style={{ backgroundColor: currentTick ? '#00C27A' : '#C1121F', boxShadow: currentTick ? '0 0 6px rgba(0,194,122,0.5)' : '0 0 6px rgba(193,18,31,0.5)' }} />
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mr-1 shrink-0 uppercase tracking-wider" style={{ backgroundColor: isLiveData ? 'rgba(0,194,122,0.15)' : 'rgba(255,152,0,0.15)', color: isLiveData ? '#00C27A' : '#FF9800', border: `1px solid ${isLiveData ? 'rgba(0,194,122,0.3)' : 'rgba(255,152,0,0.3)'}` }}>
          {isLiveData ? 'LIVE' : 'SIM'}
        </span>
        <span className="text-[13px] font-bold mr-1 font-mono shrink-0" style={{ color: '#0091D5' }}>{activeSymbol}</span>
        {displayOhlc && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-mono"><span className="opacity-30">O</span><span style={{ color: 'var(--text-secondary)' }}>{formatPrice(displayOhlc.open, decimals)}</span></span>
            <span className="text-[11px] font-mono"><span className="opacity-30">H</span><span style={{ color: '#00C27A' }}>{formatPrice(displayOhlc.high, decimals)}</span></span>
            <span className="text-[11px] font-mono"><span className="opacity-30">L</span><span style={{ color: '#C1121F' }}>{formatPrice(displayOhlc.low, decimals)}</span></span>
            <span className="text-[11px] font-mono"><span className="opacity-30">C</span><span style={{ color: 'var(--text-secondary)' }}>{formatPrice(displayOhlc.close, decimals)}</span></span>
          </div>
        )}
      </div>

      {/* Main area: Drawing sidebar + Chart */}
      <div className="flex-1 flex min-h-0">
        {/* Drawing tools sidebar */}
        <div
          className="flex flex-col items-center py-2 gap-0.5 shrink-0 overflow-y-auto"
          style={{ width: 40, backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}
        >
          {renderToolsWithSeparators()}
        </div>

        {/* Chart area */}
        <div
          className="flex-1 relative"
          style={{ backgroundColor: '#060D16', zIndex: 1 }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={(e) => {
            e.preventDefault();
            try {
              const ea = JSON.parse(e.dataTransfer.getData('text/plain'));
              if (ea?.name) {
                // Show notification that EA was attached
                const div = document.createElement('div');
                div.className = 'fixed top-20 right-4 z-[9999] px-4 py-3 rounded-lg text-sm font-semibold';
                div.style.cssText = 'background:#0091D5;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:fadeIn 0.3s ease';
                div.textContent = `EA "${ea.name}" attached to chart`;
                document.body.appendChild(div);
                setTimeout(() => div.remove(), 3000);
              }
            } catch { /* not an EA drop */ }
          }}
        >
          <div ref={chartContainerRef} className="absolute inset-0" />

          {/* Drawing canvas overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{ pointerEvents: canvasActive ? 'auto' : 'none', zIndex: 10, cursor: canvasActive ? 'crosshair' : 'default' }}
            onMouseDown={handleDrawStart}
            onMouseMove={handleDrawMove}
            onMouseUp={handleDrawEnd}
          />

          {/* Indicator Panel dropdown */}
          {showIndicatorPanel && (
            <IndicatorPanel
              activeIndicators={activeIndicators}
              indicatorParams={indicatorParams}
              onToggle={handleIndicatorToggle}
              onUpdateParams={handleIndicatorParamsUpdate}
              onClose={() => setShowIndicatorPanel(false)}
            />
          )}

          {/* Bid/Ask spread overlay */}
          {currentTick && (
            <div className="absolute top-2 right-2 z-20 px-3 py-1.5 rounded" style={{ backgroundColor: 'rgba(17,17,24,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3 text-[12px] font-mono">
                <div><span className="opacity-40 mr-1">B</span><span className="text-green-400">{formatPrice(currentTick.bid, decimals)}</span></div>
                <div><span className="opacity-40 mr-1">A</span><span className="text-red-400">{formatPrice(currentTick.ask, decimals)}</span></div>
                <div className="opacity-40"><span className="mr-1">S</span><span>{currentTick.spread.toFixed(decimals > 3 ? 1 : decimals)}</span></div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {!ohlcvBuilder && (
            <div className="absolute inset-0 flex items-center justify-center z-5">
              <div className="text-center opacity-30">
                <BarChart3 size={48} className="mx-auto mb-3 animate-pulse" />
                <div className="text-sm font-medium">Initializing chart...</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
