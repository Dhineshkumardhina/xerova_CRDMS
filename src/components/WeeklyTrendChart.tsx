import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TrendingUp, Activity, Calendar } from 'lucide-react';
import { CriminalProfile } from '../types';

interface DataPoint {
  label: string;
  fullDate: string;
  records: number;
  warrants: number;
  cleared: number;
}

const WEEKLY_DATA: Record<'7d' | '8w' | '30d', DataPoint[]> = {
  '7d': [
    { label: 'Mon', fullDate: 'Aug 16', records: 28, warrants: 6, cleared: 19 },
    { label: 'Tue', fullDate: 'Aug 17', records: 35, warrants: 9, cleared: 22 },
    { label: 'Wed', fullDate: 'Aug 18', records: 31, warrants: 5, cleared: 26 },
    { label: 'Thu', fullDate: 'Aug 19', records: 46, warrants: 12, cleared: 30 },
    { label: 'Fri', fullDate: 'Aug 20', records: 52, warrants: 14, cleared: 34 },
    { label: 'Sat', fullDate: 'Aug 21', records: 39, warrants: 8, cleared: 28 },
    { label: 'Sun', fullDate: 'Aug 22', records: 44, warrants: 11, cleared: 31 },
  ],
  '8w': [
    { label: 'Wk 1', fullDate: 'Jun 28 - Jul 04', records: 128, warrants: 32, cleared: 94 },
    { label: 'Wk 2', fullDate: 'Jul 05 - Jul 11', records: 142, warrants: 38, cleared: 108 },
    { label: 'Wk 3', fullDate: 'Jul 12 - Jul 18', records: 135, warrants: 29, cleared: 115 },
    { label: 'Wk 4', fullDate: 'Jul 19 - Jul 25', records: 168, warrants: 45, cleared: 130 },
    { label: 'Wk 5', fullDate: 'Jul 26 - Aug 01', records: 154, warrants: 41, cleared: 122 },
    { label: 'Wk 6', fullDate: 'Aug 02 - Aug 08', records: 189, warrants: 52, cleared: 146 },
    { label: 'Wk 7', fullDate: 'Aug 09 - Aug 15', records: 172, warrants: 44, cleared: 139 },
    { label: 'Wk 8', fullDate: 'Aug 16 - Aug 22', records: 205, warrants: 56, cleared: 164 },
  ],
  '30d': [
    { label: 'Day 1', fullDate: 'Jul 24', records: 22, warrants: 5, cleared: 18 },
    { label: 'Day 5', fullDate: 'Jul 28', records: 31, warrants: 8, cleared: 24 },
    { label: 'Day 10', fullDate: 'Aug 02', records: 45, warrants: 12, cleared: 32 },
    { label: 'Day 15', fullDate: 'Aug 07', records: 38, warrants: 9, cleared: 29 },
    { label: 'Day 20', fullDate: 'Aug 12', records: 49, warrants: 14, cleared: 38 },
    { label: 'Day 25', fullDate: 'Aug 17', records: 54, warrants: 15, cleared: 41 },
    { label: 'Day 30', fullDate: 'Aug 22', records: 61, warrants: 18, cleared: 48 },
  ],
};

interface WeeklyTrendChartProps {
  allProfiles?: CriminalProfile[];
}

export const WeeklyTrendChart: React.FC<WeeklyTrendChartProps> = ({ allProfiles = [] }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [timeframe, setTimeframe] = useState<'7d' | '8w' | '30d'>('7d');
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 200 });

  const data = WEEKLY_DATA[timeframe];
  const totalInPeriod = data.reduce((acc, curr) => acc + curr.records, 0);
  const avgInPeriod = Math.round(totalInPeriod / data.length);
  const peakVal = Math.max(...data.map((d) => d.records));

  // Resize observer to ensure responsive width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          setDimensions({
            width: Math.max(width, 280),
            height: 200,
          });
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // D3 Rendering
  useEffect(() => {
    if (!svgRef.current || dimensions.width <= 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 16, right: 24, bottom: 28, left: 36 };
    const innerWidth = dimensions.width - margin.left - margin.right;
    const innerHeight = dimensions.height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Define gradients
    const defs = svg.append('defs');

    // Slate blue fill gradient
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'slateBlueGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#3B5B7A')
      .attr('stop-opacity', 0.22);

    areaGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#3B5B7A')
      .attr('stop-opacity', 0.0);

    // Scales
    const xScale = d3
      .scalePoint<string>()
      .domain(data.map((d: DataPoint) => d.label))
      .range([0, innerWidth])
      .padding(0.1);

    const maxVal: number = d3.max(data, (d: DataPoint) => d.records) ?? 60;
    const minVal = 0;
    const yScale = d3
      .scaleLinear()
      .domain([minVal, Math.ceil(maxVal * 1.15)])
      .range([innerHeight, 0])
      .nice();

    // Horizontal grid lines
    const yTicks = yScale.ticks(4);
    g.append('g')
      .attr('class', 'grid')
      .selectAll<SVGLineElement, number>('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerWidth)
      .attr('y1', (d: number) => yScale(d))
      .attr('y2', (d: number) => yScale(d))
      .attr('stroke', '#E5E5E5')
      .attr('stroke-dasharray', '3 3')
      .attr('stroke-width', 1);

    // Y Axis Labels
    g.append('g')
      .attr('class', 'y-axis')
      .selectAll<SVGTextElement, number>('text')
      .data(yTicks)
      .enter()
      .append('text')
      .attr('x', -8)
      .attr('y', (d: number) => yScale(d) + 3)
      .attr('text-anchor', 'end')
      .attr('fill', '#525252')
      .attr('font-size', '10px')
      .attr('font-family', 'ui-monospace, monospace')
      .text((d: number) => d.toString());

    // X Axis Labels
    g.append('g')
      .attr('class', 'x-axis')
      .selectAll<SVGTextElement, DataPoint>('text')
      .data(data)
      .enter()
      .append('text')
      .attr('x', (d: DataPoint) => xScale(d.label) ?? 0)
      .attr('y', innerHeight + 20)
      .attr('text-anchor', 'middle')
      .attr('fill', '#525252')
      .attr('font-size', '11px')
      .attr('font-weight', '500')
      .text((d: DataPoint) => d.label);

    // Area Generator
    const areaGenerator = d3
      .area<DataPoint>()
      .x((d) => xScale(d.label) ?? 0)
      .y0(innerHeight)
      .y1((d) => yScale(d.records))
      .curve(d3.curveMonotoneX);

    // Draw Area
    g.append('path')
      .datum(data)
      .attr('fill', 'url(#slateBlueGradient)')
      .attr('d', areaGenerator);

    // Line Generator
    const lineGenerator = d3
      .line<DataPoint>()
      .x((d) => xScale(d.label) ?? 0)
      .y((d) => yScale(d.records))
      .curve(d3.curveMonotoneX);

    // Draw Line in #3B5B7A
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#3B5B7A')
      .attr('stroke-width', 2.5)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('d', lineGenerator);

    // Dots and interactive overlay
    const pointsGroup = g.append('g').attr('class', 'points');

    data.forEach((d) => {
      const cx = xScale(d.label) ?? 0;
      const cy = yScale(d.records);

      // Outer halo
      pointsGroup
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 5)
        .attr('fill', '#FFFFFF')
        .attr('stroke', '#3B5B7A')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer');

      // Center dot
      pointsGroup
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 2.5)
        .attr('fill', '#3B5B7A')
        .style('cursor', 'pointer');

      // Invisible hit area for tooltip
      pointsGroup
        .append('rect')
        .attr('x', cx - 18)
        .attr('y', 0)
        .attr('width', 36)
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseenter', () => setHoveredPoint(d))
        .on('mouseleave', () => setHoveredPoint(null));
    });
  }, [data, dimensions]);

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[#E5E5E5]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[8px] bg-[#3B5B7A]/10 border border-[#3B5B7A]/20 flex items-center justify-center text-[#3B5B7A]">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] font-bold text-[#171717]">Criminal Record Activity Trends</h3>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-[4px] bg-[#3B5B7A]/10 text-[#3B5B7A] border border-[#3B5B7A]/20">
                LIVE D3
              </span>
            </div>
            <p className="text-[13px] text-[#525252]">
              Weekly intake volume &amp; case clearance trajectory
            </p>
          </div>
        </div>

        {/* Timeframe selector tabs */}
        <div className="flex items-center bg-[#F3F3F4] p-1 rounded-[8px] border border-[#E5E5E5] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setTimeframe('7d')}
            className={`px-3 py-1 text-[12px] font-semibold rounded-[6px] transition-colors cursor-pointer ${
              timeframe === '7d'
                ? 'bg-white text-[#171717] shadow-xs'
                : 'text-[#525252] hover:text-[#171717]'
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('8w')}
            className={`px-3 py-1 text-[12px] font-semibold rounded-[6px] transition-colors cursor-pointer ${
              timeframe === '8w'
                ? 'bg-white text-[#171717] shadow-xs'
                : 'text-[#525252] hover:text-[#171717]'
            }`}
          >
            8 Weeks
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('30d')}
            className={`px-3 py-1 text-[12px] font-semibold rounded-[6px] transition-colors cursor-pointer ${
              timeframe === '30d'
                ? 'bg-white text-[#171717] shadow-xs'
                : 'text-[#525252] hover:text-[#171717]'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-neutral-50/70 p-3 rounded-[8px] border border-[#E5E5E5]">
          <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">Total Intake</div>
          <div className="text-[18px] font-bold text-[#171717] font-mono">{totalInPeriod}</div>
          <div className="text-[11px] text-[#3B5B7A] font-medium mt-0.5">Recorded incidents</div>
        </div>
        <div className="bg-neutral-50/70 p-3 rounded-[8px] border border-[#E5E5E5]">
          <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">Average Intake</div>
          <div className="text-[18px] font-bold text-[#171717] font-mono">{avgInPeriod} / period</div>
          <div className="text-[11px] text-[#525252] mt-0.5">Standard run rate</div>
        </div>
        <div className="bg-neutral-50/70 p-3 rounded-[8px] border border-[#E5E5E5]">
          <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">Peak Volume</div>
          <div className="text-[18px] font-bold text-[#171717] font-mono">{peakVal}</div>
          <div className="text-[11px] text-[#525252] mt-0.5">Maximum point</div>
        </div>
        <div className="bg-neutral-50/70 p-3 rounded-[8px] border border-[#E5E5E5]">
          <div className="text-[11px] font-bold text-[#525252] uppercase mb-0.5">Net Clearance</div>
          <div className="text-[18px] font-bold text-emerald-700 font-mono">76.4%</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-0.5">+4.2% resolution</div>
        </div>
      </div>

      {/* D3 Chart Canvas */}
      <div ref={containerRef} className="relative w-full overflow-hidden select-none">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full overflow-visible"
        />

        {/* Dynamic Tooltip on Hover */}
        {hoveredPoint && (
          <div className="absolute top-2 right-3 bg-neutral-900 text-white px-3 py-2 rounded-[8px] shadow-md pointer-events-none text-[12px] flex items-center gap-3 z-10 border border-neutral-700 animate-in fade-in">
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3B5B7A]" />
                <span>{hoveredPoint.fullDate} ({hoveredPoint.label})</span>
              </div>
              <div className="text-neutral-300 text-[11px] mt-0.5">
                <span className="text-white font-mono font-bold">{hoveredPoint.records}</span> new records &bull;{' '}
                <span className="text-rose-300 font-mono">{hoveredPoint.warrants}</span> warrants &bull;{' '}
                <span className="text-emerald-300 font-mono">{hoveredPoint.cleared}</span> cleared
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend & Footer Note */}
      <div className="mt-3 pt-2.5 border-t border-[#E5E5E5] flex flex-wrap items-center justify-between text-[11px] text-[#525252] gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-[#3B5B7A] rounded-full inline-block" />
            <span className="font-medium text-[#171717]">Record Influx Trend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3B5B7A]/20 border border-[#3B5B7A] inline-block" />
            <span>Interpolated Monotone Spline</span>
          </div>
        </div>
        <span className="font-mono">Updated: Realtime Sync &bull; District 4</span>
      </div>
    </div>
  );
};
