'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Clock, CandlestickChart, BarChart3, TrendingUp, AreaChart,
  Activity, Pencil, LayoutGrid, Trash2, ChevronDown, HelpCircle, Bot,
  // Drawing tools
  MousePointer2, ArrowUpRight, Circle, GitCommitHorizontal,
  Flag, LineChart, Square, Ruler, Minus, Move,
  // Layout icons
  Columns2, Rows2, Columns3, Rows3, Grid2x2, LayoutPanelLeft, Grid3x3,
  // EA
  GripVertical, Star, Zap,
} from 'lucide-react';
import type { IndicatorId } from './IndicatorPanel';

// ─── Types ───────────────────────────────────────────────────────

export type ChartType = 'candlestick' | 'bar' | 'line' | 'area';
export type LayoutType = 'single' | 'split' | 'vsplit' | 'h3' | 'v3' | 'quarters' | 'onefive' | 'table3x2';

const TIMEFRAMES = [
  { label: '1 Minute',   value: '1m' },
  { label: '5 Minutes',  value: '5m' },
  { label: '15 Minutes', value: '15m' },
  { label: '30 Minutes', value: '30m' },
  { label: '1 Hour',     value: '1H' },
  { label: '4 Hours',    value: '4H' },
  { label: '1 Day',      value: '1D' },
  { label: '1 Week',     value: '1W' },
  { label: '1 Month',    value: '1Mo' },
];

const CHART_TYPES: { label: string; value: ChartType; icon: React.ReactNode }[] = [
  { label: 'Bars',       value: 'bar',         icon: <BarChart3 size={16} /> },
  { label: 'Candles',    value: 'candlestick',  icon: <CandlestickChart size={16} /> },
  { label: 'Line',       value: 'line',         icon: <TrendingUp size={16} /> },
  { label: 'Area',       value: 'area',         icon: <AreaChart size={16} /> },
];

const DRAWING_TOOLS = [
  { label: 'ABCD Pattern',           icon: <GitCommitHorizontal size={16} /> },
  { label: 'Arrow',                  icon: <ArrowUpRight size={16} /> },
  { label: 'Circle',                 icon: <Circle size={16} /> },
  { label: 'Fibonacci Arcs',         icon: <Activity size={16} /> },
  { label: 'Fibonacci Retracement',  icon: <GitCommitHorizontal size={16} /> },
  { label: 'Flag',                   icon: <Flag size={16} /> },
  { label: 'Forecast',               icon: <LineChart size={16} /> },
  { label: 'Gann Box',               icon: <Square size={16} /> },
  { label: 'Gann Fan',               icon: <Move size={16} /> },
  { label: 'Head And Shoulders',     icon: <Activity size={16} /> },
  { label: 'Horizontal Line',        icon: <Minus size={16} /> },
  { label: 'Line',                   icon: <TrendingUp size={16} /> },
  { label: 'Parallel Channel',       icon: <Columns2 size={16} /> },
  { label: 'Rectangle',              icon: <Square size={16} /> },
  { label: 'Ruler / Measure',        icon: <Ruler size={16} /> },
  { label: 'Text',                   icon: <MousePointer2 size={16} /> },
  { label: 'Trend Line',             icon: <TrendingUp size={16} /> },
];

const LAYOUTS: { label: string; value: LayoutType; icon: React.ReactNode }[] = [
  { label: 'Single',          value: 'single',     icon: <Square size={16} /> },
  { label: 'Split',           value: 'split',       icon: <Columns2 size={16} /> },
  { label: 'Vertical Split',  value: 'vsplit',      icon: <Rows2 size={16} /> },
  { label: 'Horizontal x3',   value: 'h3',          icon: <Rows3 size={16} /> },
  { label: 'Vertical x3',     value: 'v3',          icon: <Columns3 size={16} /> },
  { label: 'Quarters',        value: 'quarters',    icon: <Grid2x2 size={16} /> },
  { label: 'One+Five',        value: 'onefive',     icon: <LayoutPanelLeft size={16} /> },
  { label: 'Table 3x2',       value: 'table3x2',    icon: <Grid3x3 size={16} /> },
];

// ─── EA / Robot definitions ───────────────────────────────────────

interface EAConfig {
  id: string;
  name: string;
  description: string;
  pairs: string[];
  timeframes: string[];
  type: 'scalper' | 'trend' | 'grid' | 'hedge' | 'martingale';
  rating: number;
  status: 'active' | 'paused' | 'available';
}

const MOCK_EAS: EAConfig[] = [
  {
    id: 'ea-001', name: 'RAPTOR Scalper Pro',
    description: 'High-frequency scalping EA using price action and momentum. Targets 5-15 pip moves with tight stop losses.',
    pairs: ['EURUSD', 'GBPUSD', 'USDJPY'],
    timeframes: ['1m', '5m'],
    type: 'scalper', rating: 4.8, status: 'available',
  },
  {
    id: 'ea-002', name: 'GoldRush V3',
    description: 'Specialized gold trading robot using Ichimoku Cloud + RSI divergence. Optimized for XAUUSD volatility.',
    pairs: ['XAUUSD'],
    timeframes: ['15m', '1H'],
    type: 'trend', rating: 4.5, status: 'available',
  },
  {
    id: 'ea-003', name: 'Grid Master FX',
    description: 'Grid trading system with dynamic spacing. Auto-adjusts grid levels based on ATR and market regime.',
    pairs: ['EURUSD', 'AUDUSD', 'NZDUSD'],
    timeframes: ['1H', '4H'],
    type: 'grid', rating: 4.2, status: 'available',
  },
  {
    id: 'ea-004', name: 'Trend Rider AI',
    description: 'AI-powered trend following using ADX, EMA crossover, and MACD confirmation. Holds positions for days.',
    pairs: ['GBPUSD', 'EURJPY', 'GBPJPY', 'US30'],
    timeframes: ['4H', '1D'],
    type: 'trend', rating: 4.6, status: 'available',
  },
  {
    id: 'ea-005', name: 'Hedge Shield',
    description: 'Hedging EA that opens opposing positions to limit drawdown. Uses correlation analysis between pairs.',
    pairs: ['EURUSD', 'USDCHF', 'EURGBP'],
    timeframes: ['1H', '4H'],
    type: 'hedge', rating: 4.1, status: 'available',
  },
  {
    id: 'ea-006', name: 'Crypto Sniper Bot',
    description: 'Designed for BTC/ETH. Uses volume profile + order flow imbalance to catch breakout moves.',
    pairs: ['BTCUSD', 'ETHUSD'],
    timeframes: ['5m', '15m'],
    type: 'scalper', rating: 4.3, status: 'available',
  },
  {
    id: 'ea-007', name: 'Index Momentum Pro',
    description: 'Trades US30, NAS100, SPX500 using Bollinger Band squeezes and momentum bursts during session opens.',
    pairs: ['US30', 'NAS100', 'SPX500'],
    timeframes: ['15m', '1H'],
    type: 'trend', rating: 4.7, status: 'available',
  },
  {
    id: 'ea-008', name: 'Oil Trader V2',
    description: 'Crude oil specialist using supply/demand zones and inventory data. Works on USOIL and UKOIL.',
    pairs: ['USOIL', 'UKOIL'],
    timeframes: ['1H', '4H'],
    type: 'trend', rating: 4.0, status: 'available',
  },
];

const EA_TYPE_COLORS: Record<string, string> = {
  scalper: '#FF9800', trend: '#00C27A', grid: '#0091D5', hedge: '#AB47BC', martingale: '#FF5252',
};

// ─── Toolbar Props ────────────────────────────────────────────────

interface ChartToolbarProps {
  selectedTf: string;
  onTfChange: (tf: string) => void;
  chartType: ChartType;
  onChartTypeChange: (ct: ChartType) => void;
  oneClickTrading: boolean;
  onOneClickTradingToggle: () => void;
  activeIndicators: Set<IndicatorId>;
  onShowIndicators: () => void;
  onClearAll: () => void;
  activeLayout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;
}

export default function ChartToolbar({
  selectedTf,
  onTfChange,
  chartType,
  onChartTypeChange,
  oneClickTrading,
  onOneClickTradingToggle,
  activeIndicators,
  onShowIndicators,
  onClearAll,
  activeLayout,
  onLayoutChange,
}: ChartToolbarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close any open dropdown on outside click
  useEffect(() => {
    if (!openDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdown]);

  const toggle = useCallback((id: string) => {
    setOpenDropdown((prev) => prev === id ? null : id);
  }, []);

  const close = useCallback(() => setOpenDropdown(null), []);

  const tfDef = TIMEFRAMES.find((t) => t.value === selectedTf) || TIMEFRAMES[4];
  const ctDef = CHART_TYPES.find((c) => c.value === chartType) || CHART_TYPES[1];

  const btnBase = 'flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-all shrink-0 cursor-pointer';

  // Dropdown panel style — MUST be z-[999] to render above everything including the chart
  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    backgroundColor: '#111118',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
    zIndex: 9999,
    overflow: 'hidden',
  };

  return (
    <div
      ref={toolbarRef}
      className="flex items-center gap-1.5 px-3 border-b shrink-0 overflow-x-auto"
      style={{
        height: 44,
        minHeight: 44,
        backgroundColor: '#0D1117',
        borderColor: 'rgba(255,255,255,0.06)',
        scrollbarWidth: 'none',
        position: 'relative',
        zIndex: 100,
      }}
    >
      {/* 1-Click Trading toggle */}
      <div className="flex items-center gap-2 mr-2 shrink-0">
        <button
          onClick={onOneClickTradingToggle}
          className="relative rounded-full transition-colors"
          style={{ width: 36, height: 18, backgroundColor: oneClickTrading ? '#0091D5' : 'rgba(255,255,255,0.12)' }}
        >
          <div className="absolute top-[2px] rounded-full transition-all bg-white" style={{ width: 14, height: 14, left: oneClickTrading ? 20 : 2 }} />
        </button>
        <span className="text-[11px] font-semibold text-white whitespace-nowrap">1-Click Trading</span>
        <HelpCircle size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
      </div>

      <div className="w-px h-5 mx-1 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

      {/* Timeframe Dropdown */}
      <div className="relative shrink-0">
        <button onClick={() => toggle('tf')} className={`${btnBase} bg-[#0091D5] text-white`}>
          <Clock size={14} /> {tfDef.label} <ChevronDown size={12} className={openDropdown === 'tf' ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {openDropdown === 'tf' && (
          <div style={{ ...dropdownStyle, width: 200 }}>
            <div className="py-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => { onTfChange(tf.value); close(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                  style={{ color: selectedTf === tf.value ? '#0091D5' : 'rgba(255,255,255,0.7)', fontWeight: selectedTf === tf.value ? 600 : 400, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <Clock size={14} style={{ opacity: 0.5 }} /> {tf.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart Type Dropdown */}
      <div className="relative shrink-0">
        <button onClick={() => toggle('ct')} className={`${btnBase} bg-[rgba(255,255,255,0.06)] text-white`}>
          {ctDef.icon} {ctDef.label} <ChevronDown size={12} className={openDropdown === 'ct' ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {openDropdown === 'ct' && (
          <div style={{ ...dropdownStyle, width: 180 }}>
            <div className="py-1">
              {CHART_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => { onChartTypeChange(ct.value); close(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                  style={{ color: chartType === ct.value ? '#0091D5' : 'rgba(255,255,255,0.7)', fontWeight: chartType === ct.value ? 600 : 400, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  {ct.icon} {ct.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-5 mx-1 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

      {/* Indicators Button */}
      <button
        onClick={() => { onShowIndicators(); close(); }}
        className={`${btnBase} ${activeIndicators.size > 0 ? 'bg-[#0091D5] text-white' : 'text-[rgba(255,255,255,0.65)] hover:text-white hover:bg-[rgba(255,255,255,0.06)]'}`}
      >
        <Activity size={14} /> Indicators
        {activeIndicators.size > 0 && <span className="text-[9px] bg-white/20 px-1 rounded">{activeIndicators.size}</span>}
      </button>

      {/* Tools Dropdown */}
      <div className="relative shrink-0">
        <button onClick={() => toggle('tools')} className={`${btnBase} text-[rgba(255,255,255,0.65)] hover:text-white hover:bg-[rgba(255,255,255,0.06)]`}>
          <Pencil size={14} /> Tools <ChevronDown size={12} className={openDropdown === 'tools' ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {openDropdown === 'tools' && (
          <div style={{ ...dropdownStyle, width: 240, maxHeight: 420, overflowY: 'auto' }}>
            <div className="py-1" style={{ scrollbarWidth: 'thin' }}>
              {DRAWING_TOOLS.map((tool) => (
                <button
                  key={tool.label}
                  onClick={() => { window.dispatchEvent(new CustomEvent('raptor-drawing-tool', { detail: tool.label })); close(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] text-[rgba(255,255,255,0.7)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <span style={{ color: '#0091D5' }}>{tool.icon}</span> {tool.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Multiscreen Dropdown */}
      <div className="relative shrink-0">
        <button onClick={() => toggle('layout')} className={`${btnBase} text-[rgba(255,255,255,0.65)] hover:text-white hover:bg-[rgba(255,255,255,0.06)]`}>
          <LayoutGrid size={14} /> Multiscreen <ChevronDown size={12} className={openDropdown === 'layout' ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {openDropdown === 'layout' && (
          <div style={{ ...dropdownStyle, width: 210 }}>
            <div className="py-1">
              {LAYOUTS.map((layout) => (
                <button
                  key={layout.value}
                  onClick={() => { onLayoutChange(layout.value); close(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
                  style={{ color: activeLayout === layout.value ? '#0091D5' : 'rgba(255,255,255,0.7)', fontWeight: activeLayout === layout.value ? 600 : 400, borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <span style={{ color: '#0091D5' }}>{layout.icon}</span> {layout.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* EA / Robots Dropdown */}
      <div className="relative shrink-0">
        <button onClick={() => toggle('ea')} className={`${btnBase} text-[rgba(255,255,255,0.65)] hover:text-white hover:bg-[rgba(255,255,255,0.06)]`}>
          <Bot size={14} /> EAs / Robots <ChevronDown size={12} className={openDropdown === 'ea' ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
        {openDropdown === 'ea' && (
          <div style={{ ...dropdownStyle, width: 360, maxHeight: 480, overflowY: 'auto' }}>
            {/* Header */}
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-[12px] font-semibold text-white">Expert Advisors</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(0,145,213,0.15)', color: '#0091D5' }}>
                {MOCK_EAS.length} available
              </span>
            </div>
            <div className="text-[9px] px-3 py-1.5" style={{ color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              Drag and drop an EA onto the chart to activate it
            </div>

            {/* EA List */}
            <div className="py-1" style={{ scrollbarWidth: 'thin' }}>
              {MOCK_EAS.map((ea) => (
                <div
                  key={ea.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', JSON.stringify(ea));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  className="px-3 py-2.5 cursor-grab active:cursor-grabbing transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical size={14} style={{ color: 'rgba(255,255,255,0.15)', marginTop: 2 }} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[12px] font-semibold text-white truncate">{ea.name}</span>
                        <span className="text-[8px] px-1 py-0.5 rounded uppercase font-bold shrink-0" style={{ backgroundColor: `${EA_TYPE_COLORS[ea.type]}20`, color: EA_TYPE_COLORS[ea.type] }}>
                          {ea.type}
                        </span>
                      </div>
                      <div className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
                        {ea.description}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>Pairs:</span>
                          {ea.pairs.map((p) => (
                            <span key={p} className="text-[9px] font-mono px-1 rounded" style={{ backgroundColor: 'rgba(0,145,213,0.1)', color: '#0091D5' }}>{p}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[8px] uppercase" style={{ color: 'rgba(255,255,255,0.25)' }}>TF:</span>
                          {ea.timeframes.map((tf) => (
                            <span key={tf} className="text-[9px] font-mono px-1 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>{tf}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={9} fill={i < Math.floor(ea.rating) ? '#FFD700' : 'transparent'} style={{ color: i < Math.floor(ea.rating) ? '#FFD700' : 'rgba(255,255,255,0.15)' }} />
                          ))}
                          <span className="text-[9px] ml-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{ea.rating}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Upload section */}
            <div className="px-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <button className="w-full flex items-center justify-center gap-2 py-2 rounded-md text-[11px] font-semibold transition-all hover:bg-[rgba(0,145,213,0.15)]" style={{ border: '1px dashed rgba(0,145,213,0.3)', color: '#0091D5' }}>
                <Zap size={14} /> Upload Custom EA (.mq5, .ex5)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clear All Button */}
      <button onClick={onClearAll} className={`${btnBase} text-red-400 hover:bg-red-500/10 hover:text-red-300`} title="Clear all indicators, EAs and drawings from chart">
        <Trash2 size={14} /> Clear All
      </button>
    </div>
  );
}
