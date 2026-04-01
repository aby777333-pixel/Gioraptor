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
import { BarChart3, Crosshair, CandlestickChart, TrendingUp } from 'lucide-react';
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

function getDecimals(symbol: string): number {
  if (['USDJPY', 'EURJPY', 'GBPJPY'].includes(symbol)) return 3;
  if (symbol.startsWith('XAU') || symbol.startsWith('ETH')) return 2;
  if (symbol === 'XAGUSD' || symbol === 'NATGAS') return 3;
  if (symbol.startsWith('BTC') || symbol === 'US30' || symbol === 'NAS100' || symbol === 'SPX500') return 1;
  if (symbol === 'USOIL' || symbol === 'UKOIL') return 2;
  return 5;
}

export default function ChartPanel({ ohlcvBuilder }: ChartPanelProps) {
  const { activeSymbol, prices } = useTradingStore();
  const [selectedTf, setSelectedTf] = useState<string>('1H');
  const [chartType, setChartType] = useState<ChartType>('candlestick');
  const [crosshairEnabled, setCrosshairEnabled] = useState(true);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const priceLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null);
  const linePriceLineRef = useRef<ReturnType<ISeriesApi<'Line'>['createPriceLine']> | null>(null);
  const lastBarTimeRef = useRef<number>(0);

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

  return (
    <div className="flex flex-col h-full w-full">
      {/* Chart toolbar */}
      <div
        className="flex items-center gap-1 px-3 py-1 border-b shrink-0"
        style={{
          backgroundColor: '#111118',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {/* Symbol label */}
        <span
          className="text-xs font-bold mr-3 font-mono"
          style={{ color: '#29ABE2' }}
        >
          {activeSymbol}
        </span>

        {/* Timeframe buttons */}
        {timeframes.map((tf) => (
          <button
            key={tf}
            onClick={() => setSelectedTf(tf)}
            className={cn(
              'px-2 py-1 text-[11px] font-mono rounded transition-all',
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
          className="w-px h-4 mx-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        />

        {/* Chart type toggle */}
        <button
          onClick={() => setChartType(chartType === 'candlestick' ? 'line' : 'candlestick')}
          className={cn(
            'flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-opacity',
            'opacity-60 hover:opacity-90'
          )}
          style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
          title={chartType === 'candlestick' ? 'Switch to line' : 'Switch to candlestick'}
        >
          {chartType === 'candlestick' ? (
            <CandlestickChart size={12} />
          ) : (
            <TrendingUp size={12} />
          )}
          <span className="hidden sm:inline">
            {chartType === 'candlestick' ? 'Candles' : 'Line'}
          </span>
        </button>

        {/* Crosshair toggle */}
        <button
          onClick={() => setCrosshairEnabled(!crosshairEnabled)}
          className={cn(
            'flex items-center gap-1 px-2 py-1 text-[11px] rounded transition-opacity',
            crosshairEnabled ? 'opacity-90' : 'opacity-40'
          )}
          style={{
            backgroundColor: crosshairEnabled ? 'rgba(41,171,226,0.15)' : 'rgba(255,255,255,0.04)',
          }}
          title="Toggle crosshair"
        >
          <Crosshair size={12} />
        </button>
      </div>

      {/* Chart area */}
      <div className="flex-1 relative" style={{ backgroundColor: '#0A0A0F' }}>
        <div ref={chartContainerRef} className="absolute inset-0" />

        {/* Bid/Ask spread overlay */}
        {currentTick && (
          <div
            className="absolute top-2 right-2 z-10 px-3 py-1.5 rounded"
            style={{ backgroundColor: 'rgba(17,17,24,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-3 text-[11px] font-mono">
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
  );
}
