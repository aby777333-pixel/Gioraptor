'use client';

import { useState } from 'react';
import {
  FileText,
  BarChart3,
  DollarSign,
  Network,
  TrendingUp,
  FileCheck,
  Calendar,
  Download,
} from 'lucide-react';
import { DataTable } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { type LucideIcon } from 'lucide-react';

interface ReportDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

const REPORTS: ReportDef[] = [
  {
    id: 'daily-trading',
    title: 'Daily Trading Summary',
    description: 'Summary of all trading activity including volumes, P&L, and position counts for each day.',
    icon: BarChart3,
  },
  {
    id: 'monthly-pnl',
    title: 'Monthly P&L',
    description: 'Broker profit and loss statement including spreads, commissions, swap fees, and B-book results.',
    icon: DollarSign,
  },
  {
    id: 'ib-performance',
    title: 'IB Performance',
    description: 'Introducing broker metrics: referred clients, volumes generated, and commissions earned.',
    icon: Network,
  },
  {
    id: 'revenue-breakdown',
    title: 'Revenue Breakdown',
    description: 'Detailed revenue analysis by source: spread, commission, swap, and other fees.',
    icon: TrendingUp,
  },
  {
    id: 'kyc-pipeline',
    title: 'KYC Pipeline',
    description: 'KYC document submission and review pipeline status with processing times.',
    icon: FileCheck,
  },
];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<Record<string, unknown>[] | null>(null);

  function handleGenerate(reportId: string) {
    setSelectedReport(reportId);
    setGenerating(true);
    setReportData(null);

    // Simulate report generation
    setTimeout(() => {
      setGenerating(false);
      // Placeholder data
      setReportData(
        Array.from({ length: 10 }, (_, i) => ({
          date: new Date(Date.now() - i * 86400000).toLocaleDateString(),
          metric: `Value ${(Math.random() * 10000).toFixed(2)}`,
          count: Math.floor(Math.random() * 100),
          amount: `$${(Math.random() * 50000).toFixed(2)}`,
          change: `${(Math.random() * 20 - 10).toFixed(2)}%`,
        })),
      );
    }, 1500);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Reports</h1>
        <p className="text-xs text-secondary">Generate and export brokerage reports</p>
      </div>

      {/* Date Range Selector */}
      <div className="flex flex-wrap items-center gap-3">
        <Calendar className="h-4 w-4 text-muted" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground"
          />
          <span className="text-xs text-muted">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-foreground"
          />
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          const isSelected = selectedReport === report.id;
          return (
            <div
              key={report.id}
              className={`rounded-xl border p-5 transition-all ${
                isSelected ? 'border-accent bg-accent/5' : 'border-border bg-elevated hover:border-border-strong'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{report.title}</h3>
                  <p className="mt-1 text-[11px] text-secondary leading-relaxed">{report.description}</p>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => handleGenerate(report.id)}
                  disabled={generating && isSelected}
                  className="w-full rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
                >
                  {generating && isSelected ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Generated Report Data */}
      {reportData && selectedReport && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {REPORTS.find((r) => r.id === selectedReport)?.title} Results
            </h3>
            <button className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-secondary transition-colors hover:bg-surface hover:text-foreground">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
          <DataTable
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'metric', label: 'Metric' },
              { key: 'count', label: 'Count', align: 'right' },
              { key: 'amount', label: 'Amount', align: 'right' },
              { key: 'change', label: 'Change', align: 'right' },
            ]}
            data={reportData}
            sortable
            pageSize={10}
          />
        </div>
      )}

      {!reportData && !generating && (
        <EmptyState
          icon={FileText}
          title="Select a report"
          description="Choose a report type above and click Generate to view the results."
        />
      )}
    </div>
  );
}
