'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Clock, CandlestickChart, BarChart3, TrendingUp, AreaChart,
  Activity, Pencil, LayoutGrid, Zap, Trash2, ChevronDown, X, HelpCircle,
  // Drawing tools
  MousePointer2, ArrowUpRight, Circle, GitCommitHorizontal,
  Flag, LineChart, Square, Ruler, Minus, Move,
  // Layout icons
  Columns2, Rows2, Columns3, Rows3, Grid2x2, LayoutPanelLeft, Grid3x3,
} from 'lucide-react';
import type { IndicatorId } from './IndicatorPanel';

// ─── Types ───────────────────────────────────────────────────────

export type ChartType = 'candlestick' | 'bar' | 'line' | 'area';
export type LayoutType = 'single' | 'split' | 'vsplit' | 'h3' | 'v3' | 'quarters' | 'onefive' | 'table3x2';

interface TimeframeDef {
  label: string;
  value: string;
  icon: string; // clock emoji variant for display
}

const TIMEFRAMES: TimeframeDef[] = [
  { label: '1 Minute',   value: '1m',  icon: '1m' },
  { label: '5 Minutes',  value: '5m',  icon: '5m' },
  { label: '15 Minutes', value: '15m', icon: '15m' },
  { label: '30 Minutes', value: '30m', icon: '30m' },
  { label: '1 Hour',     value: '1H',  icon: '1H' },
  { label: '4 Hours',    value: '4H',  icon: '4H' },
  { label: '1 Day',      value: '1D',  icon: '1D' },
  { label: '1 Week',     value: '1W',  icon: '1W' },
  { label: '1 Month',    value: '1Mo', icon: '1Mo' },
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

// ─── Dropdown Wrapper ─────────────────────────────────────────────

function Dropdown({
  trigger,
  children,
  open,
  onToggle,
  width = 220,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onToggle]);

  return (
    <div ref={ref} className="relative shrink-0">
      <div onClick={onToggle} className="cursor-pointer">
        {trigger}
      </div>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-50 overflow-hidden"
          style={{
            width,
            backgroundColor: '#111118',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

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

  const toggle = (id: string) => setOpenDropdown(openDropdown === id ? null : id);
  const close = () => setOpenDropdown(null);

  const tfDef = TIMEFRAMES.find((t) => t.value === selectedTf) || TIMEFRAMES[4];
  const ctDef = CHART_TYPES.find((c) => c.value === chartType) || CHART_TYPES[1];

  const btnBase =
    'flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium rounded-md transition-all shrink-0';
  const btnActive = 'bg-[#0091D5] text-white';
  const btnInactive =
    'text-[rgba(255,255,255,0.65)] hover:text-white hover:bg-[rgba(255,255,255,0.06)]';

  return (
    <div
      className="flex items-center gap-1.5 px-3 border-b shrink-0 overflow-x-auto"
      style={{
        height: 44,
        minHeight: 44,
        backgroundColor: '#0D1117',
        borderColor: 'rgba(255,255,255,0.06)',
        scrollbarWidth: 'none',
      }}
    >
      {/* 1-Click Trading toggle */}
      <div className="flex items-center gap-2 mr-2 shrink-0">
        <button
          onClick={onOneClickTradingToggle}
          className="relative rounded-full transition-colors"
          style={{
            width: 36,
            height: 18,
            backgroundColor: oneClickTrading ? '#0091D5' : 'rgba(255,255,255,0.12)',
          }}
        >
          <div
            className="absolute top-[2px] rounded-full transition-all bg-white"
            style={{
              width: 14,
              height: 14,
              left: oneClickTrading ? 20 : 2,
            }}
          />
        </button>
        <span className="text-[11px] font-semibold text-white whitespace-nowrap">1-Click Trading</span>
        <HelpCircle size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
      </div>

      {/* Divider */}
      <div className="w-px h-5 mx-1 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

      {/* Timeframe Dropdown */}
      <Dropdown
        open={openDropdown === 'tf'}
        onToggle={() => toggle('tf')}
        width={200}
        trigger={
          <div className={`${btnBase} ${btnActive}`}>
            <Clock size={14} />
            {tfDef.label}
            <ChevronDown size={12} />
          </div>
        }
      >
        <div className="py-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => { onTfChange(tf.value); close(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
              style={{
                color: selectedTf === tf.value ? '#0091D5' : 'rgba(255,255,255,0.7)',
                fontWeight: selectedTf === tf.value ? 600 : 400,
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}
            >
              <Clock size={14} style={{ opacity: 0.5 }} />
              {tf.label}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Chart Type Dropdown */}
      <Dropdown
        open={openDropdown === 'ct'}
        onToggle={() => toggle('ct')}
        width={180}
        trigger={
          <div className={`${btnBase} bg-[rgba(255,255,255,0.06)] text-white`}>
            {ctDef.icon}
            {ctDef.label}
            <ChevronDown size={12} />
          </div>
        }
      >
        <div className="py-1">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.value}
              onClick={() => { onChartTypeChange(ct.value); close(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
              style={{
                color: chartType === ct.value ? '#0091D5' : 'rgba(255,255,255,0.7)',
                fontWeight: chartType === ct.value ? 600 : 400,
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}
            >
              {ct.icon}
              {ct.label}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Divider */}
      <div className="w-px h-5 mx-1 shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

      {/* Indicators Button */}
      <button
        onClick={() => { onShowIndicators(); close(); }}
        className={`${btnBase} ${activeIndicators.size > 0 ? btnActive : btnInactive}`}
      >
        <Activity size={14} />
        Indicators
        {activeIndicators.size > 0 && (
          <span className="text-[9px] bg-white/20 px-1 rounded">{activeIndicators.size}</span>
        )}
      </button>

      {/* Tools Dropdown */}
      <Dropdown
        open={openDropdown === 'tools'}
        onToggle={() => toggle('tools')}
        width={240}
        trigger={
          <div className={`${btnBase} ${btnInactive}`}>
            <Pencil size={14} />
            Tools
          </div>
        }
      >
        <div className="py-1 max-h-[400px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {DRAWING_TOOLS.map((tool) => (
            <button
              key={tool.label}
              onClick={() => {
                // Dispatch event for the drawing tool
                window.dispatchEvent(new CustomEvent('raptor-drawing-tool', { detail: tool.label }));
                close();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] text-[rgba(255,255,255,0.7)] transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-white"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
            >
              <span style={{ color: '#0091D5' }}>{tool.icon}</span>
              {tool.label}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Multiscreen Dropdown */}
      <Dropdown
        open={openDropdown === 'layout'}
        onToggle={() => toggle('layout')}
        width={200}
        trigger={
          <div className={`${btnBase} ${btnInactive}`}>
            <LayoutGrid size={14} />
            Multiscreen
          </div>
        }
      >
        <div className="py-1">
          {LAYOUTS.map((layout) => (
            <button
              key={layout.value}
              onClick={() => { onLayoutChange(layout.value); close(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-[12px] transition-colors hover:bg-[rgba(255,255,255,0.05)]"
              style={{
                color: activeLayout === layout.value ? '#0091D5' : 'rgba(255,255,255,0.7)',
                fontWeight: activeLayout === layout.value ? 600 : 400,
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}
            >
              <span style={{ color: '#0091D5' }}>{layout.icon}</span>
              {layout.label}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Clear All Button */}
      <button
        onClick={onClearAll}
        className={`${btnBase} text-red-400 hover:bg-red-500/10 hover:text-red-300`}
        title="Clear all indicators and drawings from chart"
      >
        <Trash2 size={14} />
        Clear All
      </button>
    </div>
  );
}
