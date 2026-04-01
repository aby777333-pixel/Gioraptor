'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  LineStyle,
  ColorType,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  HistogramData,
  LineData,
  Time,
  DeepPartial,
  ChartOptions,
} from 'lightweight-charts';
import {
  BarChart3,
  Crosshair,
  CandlestickChart,
  TrendingUp,
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
  Filter,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useTradingStore } from '@/stores/trading';
import { cn } from '@/lib/utils/format';
import { formatPrice } from '@/lib/utils/format';
import type { OHLCVBuilder } from '@/lib/trading/ohlcv-builder';
import { TF_TO_RESOLUTION } from '@/lib/trading/ohlcv-builder';
import type { Resolution } from '@/lib/trading/ohlcv-builder';
import type { PriceTick } from '@/types/trading';

const timeframes = ['1m', '5m', '15m', '1H', '4H', '1D'] as const;

type ChartType = 'candlestick' | 'line';

interface ChartPanelProps {
  ohlcvBuilder: OHLCVBuilder | null;
}

// Symbol descriptions for the toolbar display
const SYMBOL_DESCRIPTIONS: Record<string, string> = {
  EURUSD: 'Euro vs US Dollar',
  GBPUSD: 'British Pound vs US Dollar',
  USDJPY: 'US Dollar vs Japanese Yen',
  XAUUSD: 'Gold vs US Dollar',
  XAGUSD: 'Silver vs US Dollar',
  BTCUSD: 'Bitcoin vs US Dollar',
  ETHUSD: 'Ethereum vs US Dollar',
  US30: 'Dow Jones Industrial Average',
  NAS100: 'Nasdaq 100 Index',
  SPX500: 'S&P 500 Index',
  USDCHF: 'US Dollar vs Swiss Franc',
  AUDUSD: 'Australian Dollar vs US Dollar',
  NZDUSD: 'New Zealand Dollar vs US Dollar',
  USDCAD: 'US Dollar vs Canadian Dollar',
  EURJPY: 'Euro vs Japanese Yen',
  GBPJPY: 'British Pound vs Japanese Yen',
  EURGBP: 'Euro vs British Pound',
  USOIL: 'US Crude Oil',
  UKOIL: 'UK Brent Crude Oil',
  NATGAS: 'Natural Gas',
};

// Drawing tool definitions
type DrawingToolId =
  | 'cursor'
  | 'crosshair'
  | 'trendline'
  | 'horizontal'
  | 'vertical'
  | 'fibonacci'
  | 'text'
  | 'rectangle'
  | 'measure'
  | 'zoomin'
  | 'zoomout'
  | 'magnet'
  | 'lock'
  | 'visibility'
  | 'deleteall';

interface DrawingTool {
  id: DrawingToolId;
  label: string;
  icon: React.ReactNode;
  group: number; // for separator grouping
  toggle?: boolean; // if true, it's a toggle button not a single-select
}

// Drawing data stored for canvas overlay
interface Drawing {
  type: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  text?: string;
}

// The set of tools that use the canvas overlay for drawing interactions
const CANVAS_DRAWING_TOOLS: DrawingToolId[] = ['trendline', 'horizontal', 'vertical', 'fibonacci', 'text', 'rectangle', 'measure'];

function getDecimals(symbol: string): number {
  if (['USDJPY', 'EURJPY', 'GBPJPY'].includes(symbol)) return 3;
  if (symbol.startsWith('XAU') || symbol.startsWith('ETH')) return 2;
  if (symbol === 'XAGUSD' || symbol === 'NATGAS') return 3;
  if (symbol.startsWith('BTC') || symbol === 'US30' || symbol === 'NAS100' || symbol === 'SPX500') return 1;
  if (symbol === 'USOIL' || symbol === 'UKOIL') return 2;
  return 5;
}

// Tooltip component for drawing tools
function ToolTooltip({ label, visible }: { label: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 pointer-events-none whitespace-nowrap"
      style={{
        backgroundColor: '#1a1a28',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 4,
        padding: '4px 8px',
        fontSize: 11,
        color: 'rgba(255,255,255,0.85)',
        fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      {label}
    </div>
  );
}

// Fibonacci levels
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];

// Render all stored drawings onto a canvas context
function renderDrawings(ctx: CanvasRenderingContext2D, drawings: Drawing[], canvasWidth: number, canvasHeight: number) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  for (const d of drawings) {
    ctx.strokeStyle = d.color;
    ctx.fillStyle = d.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    switch (d.type) {
      case 'trendline':
        ctx.beginPath();
        ctx.moveTo(d.startX, d.startY);
        ctx.lineTo(d.endX, d.endY);
        ctx.stroke();
        break;

      case 'horizontal':
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(0, d.startY);
        ctx.lineTo(canvasWidth, d.startY);
        ctx.stroke();
        ctx.setLineDash([]);
        break;

      case 'vertical':
        ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(d.startX, 0);
        ctx.lineTo(d.startX, canvasHeight);
        ctx.stroke();
        ctx.setLineDash([]);
        break;

      case 'rectangle':
        ctx.strokeRect(d.startX, d.startY, d.endX - d.startX, d.endY - d.startY);
        break;

      case 'fibonacci': {
        const top = Math.min(d.startY, d.endY);
        const bottom = Math.max(d.startY, d.endY);
        const range = bottom - top;
        ctx.font = '10px JetBrains Mono, monospace';
        for (const level of FIB_LEVELS) {
          const y = bottom - level * range;
          ctx.setLineDash(level === 0 || level === 1 ? [] : [4, 3]);
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.moveTo(d.startX, y);
          ctx.lineTo(d.endX, y);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillText(`${(level * 100).toFixed(1)}%`, d.endX + 4, y + 3);
        }
        ctx.setLineDash([]);
        break;
      }

      case 'measure': {
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(d.startX, d.startY);
        ctx.lineTo(d.endX, d.endY);
        ctx.stroke();
        ctx.setLineDash([]);
        // distance label
        const dx = d.endX - d.startX;
        const dy = d.endY - d.startY;
        const dist = Math.sqrt(dx * dx + dy * dy).toFixed(0);
        const midX = (d.startX + d.endX) / 2;
        const midY = (d.startY + d.endY) / 2;
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${dist}px`, midX + 6, midY - 6);
        break;
      }

      case 'text':
        if (d.text) {
          ctx.font = '13px JetBrains Mono, monospace';
          ctx.fillText(d.text, d.startX, d.startY);
        }
        break;
    }
  }
}

export default function ChartPanel({ ohlcvBuilder }: ChartPanelProps) {
  const { activeSymbol, prices } = useTradingStore();
  const [selectedTf, setSelectedTf] = useState<string>('1H');
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);

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

  // OHLC overlay state from crosshair
  const [ohlcValues, setOhlcValues] = useState<{
    open: number;
    high: number;
    low: number;
    close: number;
  } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null);
  const linePriceLineRef = useRef<ReturnType<ISeriesApi<'Line'>['createPriceLine']> | null>(null);
  const lastBarTimeRef = useRef<number>(0);
  // Track the last known crosshair price for horizontal line drawing via chart click
  const lastCrosshairPriceRef = useRef<number | null>(null);

  // Drawing tools configuration - ALL enabled, no "(Pro)" labels
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

  // Handle drawing tool click
  const handleToolClick = (tool: DrawingTool) => {
    if (tool.id === 'magnet') {
      setMagnetMode(!magnetMode);
    } else if (tool.id === 'lock') {
      setLockDrawings(!lockDrawings);
    } else if (tool.id === 'visibility') {
      setShowDrawings(!showDrawings);
    } else if (tool.id === 'deleteall') {
      // Clear canvas drawings
      setDrawings([]);
      // Remove custom price lines
      for (const pl of customPriceLinesRef.current) {
        try {
          candleSeriesRef.current?.removePriceLine(pl);
        } catch { /* noop */ }
      }
      customPriceLinesRef.current = [];
      // Clear canvas
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    } else if (tool.id === 'zoomin') {
      chartRef.current?.timeScale().applyOptions({
        barSpacing: (chartRef.current.timeScale().options().barSpacing ?? 8) + 2,
      });
    } else if (tool.id === 'zoomout') {
      const current = chartRef.current?.timeScale().options().barSpacing ?? 8;
      chartRef.current?.timeScale().applyOptions({
        barSpacing: Math.max(2, current - 2),
      });
    } else {
      setActiveTool(tool.id);
    }
  };

  // Check if a tool is "active" visually
  const isToolActive = (tool: DrawingTool): boolean => {
    if (tool.id === 'magnet') return magnetMode;
    if (tool.id === 'lock') return lockDrawings;
    if (tool.id === 'visibility') return !showDrawings;
    if (tool.id === 'deleteall') return false;
    if (tool.id === 'zoomin' || tool.id === 'zoomout') return false;
    return activeTool === tool.id;
  };

  // ============================
  // Canvas drawing event handlers
  // ============================
  const handleDrawStart = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (lockDrawings) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        setDrawings((prev) => [...prev, { type: 'text', startX: x, startY: y, endX: x, endY: y, color: '#29ABE2', text }]);
      }
      return;
    }

    if (activeTool === 'vertical') {
      setDrawings((prev) => [...prev, { type: 'vertical', startX: x, startY: y, endX: x, endY: y, color: '#29ABE2' }]);
      return;
    }

    if (activeTool === 'horizontal') {
      // For horizontal line via canvas, draw at click Y
      setDrawings((prev) => [...prev, { type: 'horizontal', startX: x, startY: y, endX: x, endY: y, color: '#29ABE2' }]);
      // Also create a real price line if we have crosshair price
      if (lastCrosshairPriceRef.current !== null && candleSeriesRef.current) {
        const pl = candleSeriesRef.current.createPriceLine({
          price: lastCrosshairPriceRef.current,
          color: '#29ABE2',
          lineWidth: 1 as const,
          lineStyle: LineStyle.Dotted,
          lineVisible: true,
          axisLabelVisible: true,
          axisLabelColor: '#29ABE2',
          axisLabelTextColor: '#ffffff',
        });
        customPriceLinesRef.current.push(pl);
      }
      return;
    }

    // For trendline, rectangle, fibonacci, measure - need start+end
    setDrawStart({ x, y });
    setIsDrawing(true);
  }, [activeTool, lockDrawings]);

  const handleDrawMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setPreviewEnd({ x, y });
  }, [isDrawing, drawStart]);

  const handleDrawEnd = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDrawings((prev) => [
      ...prev,
      {
        type: activeTool,
        startX: drawStart.x,
        startY: drawStart.y,
        endX: x,
        endY: y,
        color: '#29ABE2',
      },
    ]);

    setIsDrawing(false);
    setDrawStart(null);
    setPreviewEnd(null);
  }, [isDrawing, drawStart, activeTool]);

  // ============================
  // Repaint canvas whenever drawings or preview changes
  // ============================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!showDrawings) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Render stored drawings
    renderDrawings(ctx, drawings, canvas.width, canvas.height);

    // Render in-progress preview
    if (isDrawing && drawStart && previewEnd) {
      ctx.strokeStyle = 'rgba(41,171,226,0.6)';
      ctx.fillStyle = 'rgba(41,171,226,0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      switch (activeTool) {
        case 'trendline':
        case 'measure':
          ctx.beginPath();
          ctx.moveTo(drawStart.x, drawStart.y);
          ctx.lineTo(previewEnd.x, previewEnd.y);
          ctx.stroke();
          if (activeTool === 'measure') {
            const dx = previewEnd.x - drawStart.x;
            const dy = previewEnd.y - drawStart.y;
            const dist = Math.sqrt(dx * dx + dy * dy).toFixed(0);
            ctx.font = '11px JetBrains Mono, monospace';
            ctx.fillStyle = '#ffffff';
            ctx.setLineDash([]);
            ctx.fillText(`${dist}px`, (drawStart.x + previewEnd.x) / 2 + 6, (drawStart.y + previewEnd.y) / 2 - 6);
          }
          break;
        case 'rectangle':
          ctx.strokeRect(drawStart.x, drawStart.y, previewEnd.x - drawStart.x, previewEnd.y - drawStart.y);
          break;
        case 'fibonacci': {
          const top = Math.min(drawStart.y, previewEnd.y);
          const bottom = Math.max(drawStart.y, previewEnd.y);
          const range = bottom - top;
          ctx.font = '10px JetBrains Mono, monospace';
          for (const level of FIB_LEVELS) {
            const y = bottom - level * range;
            ctx.beginPath();
            ctx.moveTo(drawStart.x, y);
            ctx.lineTo(previewEnd.x, y);
            ctx.stroke();
          }
          break;
        }
      }
      ctx.setLineDash([]);
    }
  }, [drawings, isDrawing, drawStart, previewEnd, showDrawings, activeTool]);

  // ============================
  // Canvas resize observer - keep canvas size synced with chart container
  // ============================
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const syncSize = () => {
      const { width, height } = parent.getBoundingClientRect();
      const dpr = 1; // use 1:1 for simplicity; drawings are pixel-based
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      // Redraw after resize
      const ctx = canvas.getContext('2d');
      if (ctx && showDrawings) {
        renderDrawings(ctx, drawings, canvas.width, canvas.height);
      }
    };

    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [drawings, showDrawings]);

  // Create chart on mount
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: '#0A0A0F' },
        textColor: 'rgba(255,255,255,0.5)',
        fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(41,171,226,0.4)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#29ABE2',
        },
        horzLine: {
          color: 'rgba(41,171,226,0.4)',
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#29ABE2',
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
      },
      handleScroll: true,
      handleScale: true,
    };

    const chart = createChart(chartContainerRef.current, chartOptions);
    chartRef.current = chart;

    // Subscribe to crosshair move for OHLC display and tracking price under cursor
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setOhlcValues(null);
        return;
      }
      const candleData = param.seriesData.get(candleSeriesRef.current!) as CandlestickData | undefined;
      if (candleData && 'open' in candleData) {
        setOhlcValues({
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
        });
      }
      // Track price under cursor for horizontal line creation
      if (param.point) {
        const price = candleSeriesRef.current?.coordinateToPrice(param.point.y);
        if (price !== null && price !== undefined) {
          lastCrosshairPriceRef.current = price;
        }
      }
    });

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00C27A',
      downColor: '#C1121F',
      borderUpColor: '#00C27A',
      borderDownColor: '#C1121F',
      wickUpColor: '#00C27A',
      wickDownColor: '#C1121F',
    });
    candleSeriesRef.current = candleSeries;

    // Line series (hidden by default)
    const lineSer = chart.addSeries(LineSeries, {
      color: '#29ABE2',
      lineWidth: 2,
      visible: false,
    });
    lineSeriesRef.current = lineSer;

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
      volumeSeriesRef.current = null;
      priceLineRef.current = null;
      linePriceLineRef.current = null;
    };
  }, []);

  // Toggle crosshair mode
  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.applyOptions({
      crosshair: {
        mode: crosshairEnabled ? CrosshairMode.Normal : CrosshairMode.Hidden,
      },
    });
  }, [crosshairEnabled]);

  // Toggle chart type visibility
  useEffect(() => {
    if (candleSeriesRef.current) {
      candleSeriesRef.current.applyOptions({ visible: chartType === 'candlestick' });
    }
    if (lineSeriesRef.current) {
      lineSeriesRef.current.applyOptions({ visible: chartType === 'line' });
    }
  }, [chartType]);

  // Load data when symbol or timeframe changes
  const loadChartData = useCallback(() => {
    if (!ohlcvBuilder || !candleSeriesRef.current || !lineSeriesRef.current || !volumeSeriesRef.current) return;

    const resolution = TF_TO_RESOLUTION[selectedTf] as Resolution;
    if (!resolution) return;

    const allBars = ohlcvBuilder.getAllBars(activeSymbol, resolution);
    if (allBars.length === 0) return;

    // Candlestick data
    const candleData: CandlestickData[] = allBars.map((bar) => ({
      time: bar.time as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    // Line data (close prices)
    const lineData: LineData[] = allBars.map((bar) => ({
      time: bar.time as Time,
      value: bar.close,
    }));

    // Volume data
    const volumeData: HistogramData[] = allBars.map((bar) => ({
      time: bar.time as Time,
      value: bar.volume,
      color: bar.close >= bar.open ? 'rgba(0,194,122,0.15)' : 'rgba(193,18,31,0.15)',
    }));

    candleSeriesRef.current.setData(candleData);
    lineSeriesRef.current.setData(lineData);
    volumeSeriesRef.current.setData(volumeData);

    lastBarTimeRef.current = allBars[allBars.length - 1].time;

    // Remove old price line, create new one
    if (priceLineRef.current && candleSeriesRef.current) {
      try { candleSeriesRef.current.removePriceLine(priceLineRef.current); } catch { /* noop */ }
    }
    if (linePriceLineRef.current && lineSeriesRef.current) {
      try { lineSeriesRef.current.removePriceLine(linePriceLineRef.current); } catch { /* noop */ }
    }

    const lastPrice = allBars[allBars.length - 1].close;
    const priceLineOptions = {
      price: lastPrice,
      color: '#29ABE2',
      lineWidth: 1 as const,
      lineStyle: LineStyle.Dotted,
      lineVisible: true,
      axisLabelVisible: true,
      axisLabelColor: '#29ABE2',
      axisLabelTextColor: '#ffffff',
    };

    priceLineRef.current = candleSeriesRef.current.createPriceLine(priceLineOptions);
    linePriceLineRef.current = lineSeriesRef.current.createPriceLine(priceLineOptions);

    // Scroll to latest
    chartRef.current?.timeScale().scrollToRealTime();
  }, [activeSymbol, selectedTf, ohlcvBuilder]);

  useEffect(() => {
    loadChartData();
  }, [loadChartData]);

  // Subscribe to live tick updates for real-time candle updating
  useEffect(() => {
    if (!ohlcvBuilder || !candleSeriesRef.current || !lineSeriesRef.current || !volumeSeriesRef.current) return;

    const resolution = TF_TO_RESOLUTION[selectedTf] as Resolution;
    if (!resolution) return;

    const tick = prices[activeSymbol];
    if (!tick) return;

    // Process tick through OHLCV builder (already done in usePriceEngine)
    const currentBar = ohlcvBuilder.getCurrentBar(activeSymbol, resolution);
    if (!currentBar) return;

    // Update the last candle
    const candleUpdate: CandlestickData = {
      time: currentBar.time as Time,
      open: currentBar.open,
      high: currentBar.high,
      low: currentBar.low,
      close: currentBar.close,
    };

    const lineUpdate: LineData = {
      time: currentBar.time as Time,
      value: currentBar.close,
    };

    const volumeUpdate: HistogramData = {
      time: currentBar.time as Time,
      value: currentBar.volume,
      color: currentBar.close >= currentBar.open ? 'rgba(0,194,122,0.15)' : 'rgba(193,18,31,0.15)',
    };

    // If new bar opened, we need to reload data
    if (currentBar.time > lastBarTimeRef.current) {
      loadChartData();
    } else {
      candleSeriesRef.current.update(candleUpdate);
      lineSeriesRef.current.update(lineUpdate);
      volumeSeriesRef.current.update(volumeUpdate);
    }

    // Update price line
    if (priceLineRef.current) {
      priceLineRef.current.applyOptions({ price: tick.mid });
    }
    if (linePriceLineRef.current) {
      linePriceLineRef.current.applyOptions({ price: tick.mid });
    }
  }, [prices, activeSymbol, selectedTf, ohlcvBuilder, loadChartData]);

  // Current price info for overlay
  const currentTick = prices[activeSymbol];
  const decimals = getDecimals(activeSymbol);
  const symbolDesc = SYMBOL_DESCRIPTIONS[activeSymbol] || activeSymbol;
  const tfLabel = selectedTf;
  const chartTypeLabel = chartType === 'candlestick' ? 'C' : 'L';

  // Determine OHLC display values (crosshair or latest bar)
  const displayOhlc = ohlcValues || (currentTick ? {
    open: currentTick.mid,
    high: currentTick.mid,
    low: currentTick.mid,
    close: currentTick.mid,
  } : null);

  // Whether the drawing canvas should capture pointer events
  const canvasActive = CANVAS_DRAWING_TOOLS.includes(activeTool) && !lockDrawings;

  // Render group separators
  const renderToolsWithSeparators = () => {
    const elements: React.ReactNode[] = [];
    let lastGroup = 0;

    drawingTools.forEach((tool) => {
      // Add separator between groups
      if (tool.group !== lastGroup && lastGroup !== 0) {
        elements.push(
          <div
            key={`sep-${tool.group}`}
            className="w-full my-1"
            style={{
              height: 1,
              backgroundColor: 'rgba(255,255,255,0.06)',
              marginLeft: 4,
              marginRight: 4,
              width: 'calc(100% - 8px)',
            }}
          />
        );
      }
      lastGroup = tool.group;

      const active = isToolActive(tool);

      elements.push(
        <div key={tool.id} className="relative flex items-center justify-center">
          <button
            onClick={() => handleToolClick(tool)}
            onMouseEnter={() => setHoveredTool(tool.id)}
            onMouseLeave={() => setHoveredTool(null)}
            className="flex items-center justify-center transition-all duration-150 relative"
            style={{
              width: 30,
              height: 30,
              borderRadius: 4,
              backgroundColor: active ? 'rgba(41,171,226,0.15)' : 'transparent',
              color: active ? '#29ABE2' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
            }}
            onMouseOver={(e) => {
              if (!active) {
                e.currentTarget.style.color = 'rgba(255,255,255,1)';
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)';
              }
            }}
            onMouseOut={(e) => {
              if (!active) {
                e.currentTarget.style.color = 'rgba(255,255,255,0.5)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
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
      {/* Chart toolbar - single 40px row */}
      <div
        className="flex items-center gap-1 px-3 border-b shrink-0 overflow-x-auto"
        style={{
          height: 40,
          minHeight: 40,
          maxHeight: 40,
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border)',
          scrollbarWidth: 'none',
        }}
      >
        {/* Connection indicator */}
        <div
          className="w-2 h-2 rounded-full mr-1 shrink-0"
          style={{
            backgroundColor: currentTick ? '#00C27A' : '#C1121F',
            boxShadow: currentTick ? '0 0 6px rgba(0,194,122,0.5)' : '0 0 6px rgba(193,18,31,0.5)',
          }}
        />

        {/* Symbol label */}
        <span
          className="text-[13px] font-bold mr-1 font-mono shrink-0"
          style={{ color: '#29ABE2' }}
        >
          {activeSymbol}
        </span>

        {/* OHLC values inline */}
        {displayOhlc && (
          <div className="flex items-center gap-2 mr-1 shrink-0">
            <span className="text-[11px] font-mono">
              <span className="opacity-30">O</span>
              <span style={{ color: 'var(--text-secondary)' }}>{formatPrice(displayOhlc.open, decimals)}</span>
            </span>
            <span className="text-[11px] font-mono">
              <span className="opacity-30">H</span>
              <span style={{ color: '#00C27A' }}>{formatPrice(displayOhlc.high, decimals)}</span>
            </span>
            <span className="text-[11px] font-mono">
              <span className="opacity-30">L</span>
              <span style={{ color: '#C1121F' }}>{formatPrice(displayOhlc.low, decimals)}</span>
            </span>
            <span className="text-[11px] font-mono">
              <span className="opacity-30">C</span>
              <span style={{ color: 'var(--text-secondary)' }}>{formatPrice(displayOhlc.close, decimals)}</span>
            </span>
          </div>
        )}

        {/* Divider */}
        <div
          className="w-px h-4 mx-0.5 shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />

        {/* Timeframe buttons */}
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setSelectedTf(tf)}
            className={cn(
              'px-2 py-1 text-[11px] font-mono rounded transition-all shrink-0',
              selectedTf === tf
                ? 'font-bold opacity-100'
                : 'opacity-40 hover:opacity-70'
            )}
            style={{
              backgroundColor: selectedTf === tf ? '#29ABE2' : 'transparent',
              color: selectedTf === tf ? '#fff' : undefined,
            }}
          >
            {tf}
          </button>
        ))}

        {/* Divider */}
        <div
          className="w-px h-4 mx-0.5 shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />

        {/* Chart type toggle */}
        <button
          onClick={() => setChartType(chartType === 'candlestick' ? 'line' : 'candlestick')}
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-opacity opacity-60 hover:opacity-90 shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
          title={chartType === 'candlestick' ? 'Switch to line' : 'Switch to candlestick'}
        >
          {chartType === 'candlestick' ? (
            <CandlestickChart size={13} />
          ) : (
            <TrendingUp size={13} />
          )}
        </button>

        {/* Indicators button */}
        <button
          className="flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-opacity opacity-50 hover:opacity-80 shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
          title="Indicators"
        >
          <Filter size={13} />
        </button>

        {/* Divider */}
        <div
          className="w-px h-4 mx-0.5 shrink-0"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />

        {/* Undo / Redo */}
        <button
          className="flex items-center justify-center p-1 rounded transition-opacity opacity-30 hover:opacity-60 shrink-0"
          title="Undo"
        >
          <Undo2 size={12} />
        </button>
        <button
          className="flex items-center justify-center p-1 rounded transition-opacity opacity-30 hover:opacity-60 shrink-0"
          title="Redo"
        >
          <Redo2 size={12} />
        </button>
      </div>

      {/* Main area: Drawing sidebar + Chart */}
      <div className="flex-1 flex min-h-0">
        {/* Drawing tools sidebar */}
        <div
          className="flex flex-col items-center py-2 gap-0.5 shrink-0 overflow-y-auto"
          style={{
            width: 40,
            backgroundColor: 'var(--bg-surface)',
            borderRight: '1px solid var(--border)',
          }}
        >
          {renderToolsWithSeparators()}
        </div>

        {/* Chart area */}
        <div className="flex-1 relative" style={{ backgroundColor: '#0A0A0F' }}>
          <div ref={chartContainerRef} className="absolute inset-0" />

          {/* Drawing canvas overlay */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0"
            style={{
              pointerEvents: canvasActive ? 'auto' : 'none',
              zIndex: 10,
              cursor: canvasActive ? 'crosshair' : 'default',
            }}
            onMouseDown={handleDrawStart}
            onMouseMove={handleDrawMove}
            onMouseUp={handleDrawEnd}
          />

          {/* Bid/Ask spread overlay */}
          {currentTick && (
            <div
              className="absolute top-2 right-2 z-20 px-3 py-1.5 rounded"
              style={{ backgroundColor: 'rgba(17,17,24,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="flex items-center gap-3 text-[12px] font-mono">
                <div>
                  <span className="opacity-40 mr-1">B</span>
                  <span className="text-green-400">{formatPrice(currentTick.bid, decimals)}</span>
                </div>
                <div>
                  <span className="opacity-40 mr-1">A</span>
                  <span className="text-red-400">{formatPrice(currentTick.ask, decimals)}</span>
                </div>
                <div className="opacity-40">
                  <span className="mr-1">S</span>
                  <span>{currentTick.spread.toFixed(decimals > 3 ? 1 : decimals)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Loading state when no builder */}
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
