import React, { useState, useMemo } from 'react';
import {
  Download,
  FileText,
  TrendingUp,
  AlertTriangle,
  Calendar,
  Activity,
  Printer,
  ShieldAlert,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Area,
  ComposedChart,
  ReferenceLine,
  ReferenceDot
} from 'recharts';
import { CriminalProfile } from '../types';

interface ReportsViewProps {
  allProfiles?: CriminalProfile[];
}

// Generate realistic 30-day case frequency data with identifiable activity spikes
function generate30DayTrendData() {
  const data = [];
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - 29);

  // Baseline pattern with intentional spike anomalies (e.g. Day 12 Operation Nightfall, Day 24 Downtown Sweep)
  const dailyCasesPattern = [
    3, 4, 2, 5, 4, 3, 6, 5, 4, 7, 6, 14, 8, 5, 4, 6, 7, 5, 6, 8, 7, 9, 8, 16, 9, 6, 5, 7, 6, 8
  ];

  for (let i = 0; i < 30; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const count = dailyCasesPattern[i] ?? Math.floor(Math.random() * 6) + 3;
    const warrants = Math.max(1, Math.round(count * 0.35));
    const isSpike = count >= 12;

    data.push({
      date: dateStr,
      fullDate: d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }),
      dayIndex: i + 1,
      cases: count,
      warrants: warrants,
      isSpike: isSpike,
      spikeLabel: count === 14 ? 'Operation Apex (14 Cases)' : count === 16 ? 'Metro Sweep (16 Cases)' : undefined,
    });
  }
  return data;
}

export const ReportsView: React.FC<ReportsViewProps> = () => {
  const [activeMetric, setActiveMetric] = useState<'all' | 'spikesOnly'>('all');
  const [trendData] = useState(() => generate30DayTrendData());

  const handleDownloadCSV = () => {
    console.log('Exporting report data...');
  };

  const totalCases30Days = useMemo(() => trendData.reduce((acc, curr) => acc + curr.cases, 0), [trendData]);
  const avgCasesPerDay = (totalCases30Days / 30).toFixed(1);
  const maxSpike = useMemo(() => {
    return trendData.reduce((prev, current) => (prev.cases > current.cases ? prev : current), trendData[0]);
  }, [trendData]);

  const reports = [
    {
      id: 'rep-01',
      title: 'Quarterly Felony & Recidivism Summary',
      period: 'Q3 2024 (Jul - Sep)',
      type: 'Statistical Audit',
      size: '3.4 MB',
      classification: 'Confidential / Official Use Only',
    },
    {
      id: 'rep-02',
      title: 'Inter-Agency Warrant Enforcement Log',
      period: 'Past 30 Days',
      type: 'Operational Dispatch',
      size: '1.8 MB',
      classification: 'Law Enforcement Sensitive',
    },
    {
      id: 'rep-03',
      title: 'Biometric Facial Registry Accuracy Index',
      period: 'Year-to-Date 2024',
      type: 'System Analytics',
      size: '4.1 MB',
      classification: 'DOJ Standard Clearance',
    },
    {
      id: 'rep-04',
      title: 'Forensic Evidence Chain of Cust Custody Ledger',
      period: 'Monthly Rollup',
      type: 'Compliance Record',
      size: '890 KB',
      classification: 'Restricted Node Access',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto w-full">
      {/* View Header */}
      <div className="border-b border-[#E5E5E5] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] md:text-[30px] font-bold text-[#171717] tracking-tight">
            Judicial &amp; Operational Reports
          </h1>
          <p className="text-[14px] md:text-[16px] text-[#525252] mt-1">
            Automated intelligence summaries, crime surge diagnostics, and warrant frequency analysis.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          <button
            onClick={handleDownloadCSV}
            id="reports-download-csv-button"
            className="bg-transparent text-[#3B5B7A] hover:bg-[#3B5B7A]/10 text-[12px] font-semibold px-3.5 py-2 rounded-[8px] transition-colors flex items-center gap-2 cursor-pointer"
            title="Download report data CSV"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV</span>
          </button>
          <button
            onClick={() => alert('Generating customized departmental intelligence report...')}
            className="bg-[#171717] text-white px-4 py-2 rounded-[8px] text-[12px] font-semibold hover:bg-black flex items-center gap-2 cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>Generate New Audit</span>
          </button>
        </div>
      </div>

      {/* 30-Day Case Creation Frequency Line Chart Section */}
      <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-5 md:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-[6px] bg-[#3B5B7A]/10 text-[#3B5B7A]">
                <TrendingUp className="w-4 h-4" />
              </span>
              <h2 className="text-[16px] md:text-[18px] font-bold text-[#171717] tracking-tight">
                Case Creation Frequency &amp; Activity Spikes
              </h2>
            </div>
            <p className="text-[12px] text-[#525252]">
              Daily First Information Report (FIR) creation velocity across the past 30 days. Highlighted nodes indicate detected surge anomalies.
            </p>
          </div>

          {/* Quick Metrics & Filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-4 bg-[#F8F9FA] px-3.5 py-1.5 rounded-[8px] border border-[#E5E5E5] text-[12px]">
              <div>
                <span className="text-[#525252] text-[11px] block">30-Day Total</span>
                <strong className="font-bold text-[#171717] font-mono">{totalCases30Days} Cases</strong>
              </div>
              <div className="w-px h-6 bg-[#E5E5E5]" />
              <div>
                <span className="text-[#525252] text-[11px] block">Daily Avg</span>
                <strong className="font-bold text-[#171717] font-mono">{avgCasesPerDay} / day</strong>
              </div>
              <div className="w-px h-6 bg-[#E5E5E5]" />
              <div>
                <span className="text-[#525252] text-[11px] block">Peak Surge</span>
                <strong className="font-bold text-rose-700 font-mono">{maxSpike.cases} cases ({maxSpike.date})</strong>
              </div>
            </div>

            <div className="flex rounded-[8px] border border-[#E5E5E5] overflow-hidden p-0.5 bg-[#F8F9FA]">
              <button
                onClick={() => setActiveMetric('all')}
                className={`px-3 py-1 text-[11.5px] font-semibold rounded-[6px] transition-colors cursor-pointer ${
                  activeMetric === 'all'
                    ? 'bg-[#171717] text-white shadow-xs'
                    : 'text-[#525252] hover:text-[#171717]'
                }`}
              >
                All 30 Days
              </button>
              <button
                onClick={() => setActiveMetric('spikesOnly')}
                className={`px-3 py-1 text-[11.5px] font-semibold rounded-[6px] transition-colors flex items-center gap-1.5 cursor-pointer ${
                  activeMetric === 'spikesOnly'
                    ? 'bg-[#3B5B7A] text-white shadow-xs'
                    : 'text-[#525252] hover:text-[#171717]'
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                <span>Spike Threshold (≥10)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Spike Warning Alert when high surges detected */}
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-[8px] p-3 px-4 flex items-start sm:items-center justify-between gap-3 text-[12px] text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong>Investigative Intelligence Alert:</strong> 2 major surge spikes detected on <strong>{trendData.filter(d => d.isSpike).map(d => d.date).join(' and ')}</strong> correlating with coordinated multi-jurisdiction taskforce enforcement operations.
            </span>
          </div>
          <span className="hidden md:inline-block text-[11px] font-mono font-semibold px-2 py-0.5 rounded-[4px] bg-white text-amber-800 border border-amber-300 shrink-0">
            Threshold: +85% Above Baseline
          </span>
        </div>

        {/* Recharts Line Visualization */}
        <div className="h-[280px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={trendData}
              margin={{ top: 15, right: 20, left: -10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="caseAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B5B7A" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#3B5B7A" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
              
              <XAxis
                dataKey="date"
                stroke="#525252"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#E5E5E5' }}
                interval={2}
              />
              
              <YAxis
                stroke="#525252"
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#E5E5E5' }}
                allowDecimals={false}
                domain={[0, 20]}
              />

              {/* Reference line for Departmental Surge Threshold (10 cases) */}
              <ReferenceLine
                y={10}
                stroke="#E11D48"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: 'Surge Alert Baseline (10)',
                  position: 'insideTopRight',
                  fill: '#E11D48',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const dataPoint = payload[0].payload;
                    return (
                      <div className="bg-[#171717] text-white p-3 rounded-[8px] shadow-xl border border-neutral-700 text-[12px] min-w-[190px]">
                        <div className="font-semibold text-neutral-300 pb-1.5 border-b border-neutral-700 mb-2 flex items-center justify-between">
                          <span>{dataPoint.date}</span>
                          {dataPoint.isSpike && (
                            <span className="bg-rose-500/30 text-rose-300 text-[10px] font-bold px-1.5 py-0.5 rounded border border-rose-500/50">
                              SURGE SPIKE
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-400">Total Cases Filed:</span>
                            <span className="font-bold text-white font-mono text-[13px]">{dataPoint.cases}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-400">Warrants Generated:</span>
                            <span className="font-mono text-neutral-300">{dataPoint.warrants}</span>
                          </div>
                          {dataPoint.spikeLabel && (
                            <div className="pt-1.5 mt-1 border-t border-neutral-800 text-[11px] text-[#86B4DC]">
                              Note: {dataPoint.spikeLabel}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Area Shading Under Line */}
              <Area
                type="monotone"
                dataKey="cases"
                fill="url(#caseAreaGradient)"
                stroke="none"
              />

              {/* Main Line with custom node styling */}
              <Line
                type="monotone"
                dataKey="cases"
                stroke="#3B5B7A"
                strokeWidth={2.5}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  if (payload.isSpike) {
                    return (
                      <circle
                        key={`dot-spike-${payload.date}`}
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill="#E11D48"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      />
                    );
                  }
                  if (activeMetric === 'spikesOnly') {
                    return <circle key={`dot-hidden-${payload.date}`} cx={cx} cy={cy} r={0} />;
                  }
                  return (
                    <circle
                      key={`dot-normal-${payload.date}`}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="#3B5B7A"
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                  );
                }}
                activeDot={{ r: 6, fill: '#3B5B7A', stroke: '#FFFFFF', strokeWidth: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Legend & Context Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E5E5E5] text-[11.5px] text-[#525252]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#3B5B7A] rounded-full inline-block" />
              <span>Daily FIR Inflow</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block border border-white" />
              <span>Activity Surge Spike (≥12)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-b border-dashed border-rose-500 inline-block" />
              <span>Surge Alert Baseline (10)</span>
            </div>
          </div>
          <span className="font-mono text-[11px] text-[#525252]">
            Data Source: Central Dispatch Repository // Live 30-Day Window
          </span>
        </div>
      </div>

      {/* Existing Reports Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[16px] md:text-[18px] font-bold text-[#171717] tracking-tight">
            Published Intelligence &amp; Audit Compilations
          </h2>
          <span className="text-[12px] text-[#525252]">{reports.length} Standard Audits Available</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-white border border-[#E5E5E5] rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-[#3B5B7A]/40 hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono text-[#525252] uppercase tracking-wider font-semibold">
                    {r.type}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-[4px] bg-neutral-100 text-[#171717] border border-[#E5E5E5]">
                    {r.classification}
                  </span>
                </div>
                <h3 className="text-[16px] font-bold text-[#171717] mb-1 group-hover:text-[#3B5B7A] transition-colors">
                  {r.title}
                </h3>
                <p className="text-[12px] text-[#525252]">
                  Timeline: {r.period} • Size: {r.size}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#E5E5E5] flex items-center justify-between">
                <button
                  onClick={() => alert(`Printing report: ${r.title}`)}
                  className="text-[12px] font-semibold text-[#525252] hover:text-[#171717] flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>

                <button
                  onClick={() => alert(`Downloading verified PDF copy of "${r.title}"`)}
                  className="bg-white hover:bg-[#F3F3F4] text-[#171717] px-3.5 py-1.5 rounded-[8px] text-[12px] font-semibold flex items-center gap-1.5 border border-[#E5E5E5] cursor-pointer shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

