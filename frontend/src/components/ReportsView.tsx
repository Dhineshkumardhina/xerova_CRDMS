import React, { useState, useEffect, useMemo } from 'react';
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
  Filter,
  Loader2,
  RefreshCw
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
import { api } from '../api';

interface ReportsViewProps {
  allProfiles?: CriminalProfile[];
}

export const ReportsView: React.FC<ReportsViewProps> = () => {
  const [activeMetric, setActiveMetric] = useState<'all' | 'spikesOnly'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<{
    totalCriminals: number;
    activeCases: number;
    totalCases: number;
    categoryCounts: Array<{ category: string; count: number }>;
    statusCounts: Array<{ status: string; count: number }>;
    stationCounts: Array<{ station: string; count: number }>;
    dailyTrends: Array<{
      date: string;
      fullDate: string;
      dayIndex: number;
      cases: number;
      warrants: number;
      isSpike: boolean;
      spikeLabel?: string;
    }>;
  } | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getReportsAnalytics();
      setAnalyticsData(data);
    } catch (err: any) {
      console.error('Failed to load reports analytics:', err);
      setError(err?.message || 'Failed to fetch live PostgreSQL report analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleDownloadCSV = () => {
    if (!analyticsData) return;
    const csvRows = [
      ['Date', 'Cases Filed', 'Warrants Issued', 'Is Surge Spike'],
      ...analyticsData.dailyTrends.map((d) => [d.date, d.cases, d.warrants, d.isSpike ? 'Yes' : 'No']),
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `crms_report_analytics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const trendData = analyticsData?.dailyTrends || [];

  const totalCases30Days = useMemo(() => trendData.reduce((acc, curr) => acc + curr.cases, 0), [trendData]);
  const avgCasesPerDay = (totalCases30Days / 30).toFixed(1);
  const maxSpike = useMemo(() => {
    if (trendData.length === 0) return { cases: 0, date: 'N/A' };
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
      title: 'Forensic Evidence Chain of Custody Ledger',
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
            onClick={fetchAnalytics}
            disabled={loading}
            className="bg-white border border-[#E5E5E5] text-[#171717] hover:bg-[#F3F3F4] text-[12px] font-semibold px-3 py-2 rounded-[8px] transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Refresh Analytics Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleDownloadCSV}
            disabled={!analyticsData}
            id="reports-download-csv-button"
            className="bg-transparent text-[#3B5B7A] hover:bg-[#3B5B7A]/10 text-[12px] font-semibold px-3.5 py-2 rounded-[8px] transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
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

      {/* Loading & Error States */}
      {loading && (
        <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-12 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#3B5B7A] animate-spin" />
          <h3 className="text-[16px] font-bold text-[#171717]">Querying PostgreSQL Analytics Engine...</h3>
          <p className="text-[13px] text-[#525252]">Executing SQL aggregation queries across 15,000+ criminal dossiers and case dockets.</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-[10px] p-4 flex items-center justify-between gap-3 text-[13px] text-rose-900">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span><strong>Analytics System Error:</strong> {error}</span>
          </div>
          <button
            onClick={fetchAnalytics}
            className="px-3 py-1 bg-white border border-rose-300 rounded-[6px] text-[12px] font-semibold text-rose-800 hover:bg-rose-100 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      )}

      {!loading && !error && analyticsData && (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <span className="text-[12px] text-[#525252] font-semibold block">Total Criminal Dossiers</span>
              <strong className="text-[26px] font-extrabold text-[#171717] font-mono mt-1 block">
                {analyticsData.totalCriminals.toLocaleString()}
              </strong>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
                PostgreSQL Indexed Record Base
              </span>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <span className="text-[12px] text-[#525252] font-semibold block">Active Open Cases</span>
              <strong className="text-[26px] font-extrabold text-[#3B5B7A] font-mono mt-1 block">
                {analyticsData.activeCases.toLocaleString()}
              </strong>
              <span className="text-[11px] text-[#525252] mt-1 inline-block">
                Out of {analyticsData.totalCases.toLocaleString()} Total Dockets
              </span>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <span className="text-[12px] text-[#525252] font-semibold block">Top Crime Category</span>
              <strong className="text-[20px] font-extrabold text-[#171717] mt-1 block truncate">
                {analyticsData.categoryCounts[0]?.category || 'Theft'}
              </strong>
              <span className="text-[11px] text-[#525252] font-mono mt-1 inline-block">
                {analyticsData.categoryCounts[0]?.count || 0} Total Incidents
              </span>
            </div>

            <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <span className="text-[12px] text-[#525252] font-semibold block">30-Day Peak Inflow Surge</span>
              <strong className="text-[26px] font-extrabold text-rose-700 font-mono mt-1 block">
                {maxSpike.cases} cases
              </strong>
              <span className="text-[11px] text-[#525252] mt-1 inline-block">
                Peak Recorded Date: {maxSpike.date}
              </span>
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
            {trendData.some(d => d.isSpike) && (
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-[8px] p-3 px-4 flex items-start sm:items-center justify-between gap-3 text-[12px] text-amber-900">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
                  <span>
                    <strong>Investigative Intelligence Alert:</strong> Surge spikes detected on <strong>{trendData.filter(d => d.isSpike).map(d => d.date).join(', ')}</strong>.
                  </span>
                </div>
                <span className="hidden md:inline-block text-[11px] font-mono font-semibold px-2 py-0.5 rounded-[4px] bg-white text-amber-800 border border-amber-300 shrink-0">
                  PostgreSQL live aggregation
                </span>
              </div>
            )}

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
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="cases"
                    fill="url(#caseAreaGradient)"
                    stroke="none"
                  />

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
                  <span>Activity Surge Spike (≥10)</span>
                </div>
              </div>
              <span className="font-mono text-[11px] text-[#525252]">
                Data Source: Live PostgreSQL Database Aggregation // 30-Day Window
              </span>
            </div>
          </div>
        </>
      )}

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
