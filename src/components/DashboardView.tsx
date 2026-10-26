import React from 'react';
import { CriminalProfile, ActivityItem, CategoryStat, CrimeCategoryType } from '../types';
import { Search, Camera, AlertTriangle, ArrowUpRight, ArrowDownRight, Filter, ChevronRight } from 'lucide-react';
import { WeeklyTrendChart } from './WeeklyTrendChart';

interface DashboardViewProps {
  onSearch: (query: string) => void;
  onSelectCategory: (category: CrimeCategoryType) => void;
  onSelectProfile: (profile: CriminalProfile) => void;
  onOpenPhotoSearch: () => void;
  onViewAllRecords: () => void;
  categories: CategoryStat[];
  recentActivities: ActivityItem[];
  allProfiles: CriminalProfile[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSearch,
  onSelectCategory,
  onSelectProfile,
  onOpenPhotoSearch,
  onViewAllRecords,
  categories,
  recentActivities,
  allProfiles,
}) => {
  const [searchInput, setSearchInput] = React.useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
    }
  };

  const findProfileById = (id: string): CriminalProfile | undefined => {
    return allProfiles.find((p) => p.id === id || p.name.toLowerCase().includes(id.toLowerCase()));
  };

  const handleActivityClick = (item: ActivityItem) => {
    const profile = findProfileById(item.profileId) || allProfiles[0];
    if (profile) {
      onSelectProfile(profile);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8 max-w-[1440px] mx-auto w-full">
      {/* Super Search Bar */}
      <section>
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[22px] pointer-events-none">
            search
          </span>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search records, IDs, or plates..."
            className="w-full pl-12 pr-28 py-3.5 bg-white border border-[#E5E7EB] rounded-xl focus:outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600 text-[15px] text-neutral-900 placeholder:text-neutral-500 transition-all shadow-xs"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-neutral-900 hover:bg-black text-white text-[12px] font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer active:scale-[0.98]"
          >
            Search
          </button>
        </form>
      </section>

      {/* Photo Search Banner */}
      <section>
        <div className="bg-white rounded-[10px] border border-[#E5E5E5] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-50 border border-[#E5E5E5] rounded-[8px] flex items-center justify-center text-slate-700 shrink-0">
              <span className="material-symbols-outlined text-[26px]">center_focus_strong</span>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#171717]">Photo Search</h3>
              <p className="text-[13px] text-[#525252]">
                Biometric facial recognition &amp; landmark feature matching
              </p>
            </div>
          </div>
          <button
            onClick={onOpenPhotoSearch}
            className="w-full sm:w-auto bg-neutral-900 hover:bg-black text-white text-[13px] font-semibold py-2.5 px-5 rounded-[8px] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <Camera className="w-4 h-4" />
            <span>Launch Camera</span>
          </button>
        </div>
      </section>

      {/* Key Statistics Row */}
      <section className="-mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex md:grid md:grid-cols-3 overflow-x-auto hide-scrollbar gap-4 pb-2 snap-x">
          {/* Stat 1: Active Warrants */}
          <div className="snap-start shrink-0 w-60 md:w-auto bg-white border border-[#E5E5E5] rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border-l-4 border-l-red-600">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-[#525252] uppercase tracking-wider">
                Active Warrants
              </span>
              <span className="material-symbols-outlined text-red-600 text-[22px]">warning</span>
            </div>
            <div className="text-[30px] font-bold text-[#171717] tracking-tight animate-stat-fade-in">
              {allProfiles.filter(p => p.status === 'Warrant Issued' || p.cases?.some(c => c.status === 'Warrant Issued')).length}
            </div>
            <div className="text-[13px] text-neutral-500 font-medium mt-1 flex items-center gap-1">
              <span>Jurisdictional warrants active</span>
            </div>
          </div>

          {/* Stat 2: Total Cases */}
          <div className="snap-start shrink-0 w-60 md:w-auto bg-white border border-[#E5E5E5] rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-[#525252] uppercase tracking-wider">
                Active &amp; Prior Cases
              </span>
              <span className="material-symbols-outlined text-slate-700 text-[22px]">folder_open</span>
            </div>
            <div className="text-[30px] font-bold text-[#171717] tracking-tight animate-stat-fade-in">
              {allProfiles.reduce((sum, p) => sum + (p.cases?.length || 0), 0)}
            </div>
            <div className="text-[13px] text-[#525252] font-medium mt-1 flex items-center gap-1">
              <span>Across all suspect dockets</span>
            </div>
          </div>

          {/* Stat 3: Total Records */}
          <div className="snap-start shrink-0 w-60 md:w-auto bg-white border border-[#E5E5E5] rounded-[10px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-[#525252] uppercase tracking-wider">
                Total Profiles
              </span>
              <span className="material-symbols-outlined text-slate-700 text-[22px]">database</span>
            </div>
            <div className="text-[30px] font-bold text-[#171717] tracking-tight animate-stat-fade-in">
              {allProfiles.length}
            </div>
            <div className="text-[12px] text-[#525252] mt-1 font-mono">Live Central Registry</div>
          </div>
        </div>
      </section>

      {/* Weekly Activity Trends Chart (D3) */}
      <section>
        <WeeklyTrendChart allProfiles={allProfiles} />
      </section>

      {/* Crime Categories Grid */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] md:text-[20px] font-bold text-[#171717] tracking-tight">Categories</h2>
          <button
            onClick={onViewAllRecords}
            className="text-[12px] font-semibold text-[#525252] hover:text-[#171717] flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {categories.slice(0, 8).map((cat) => {
            const countInCat = allProfiles.filter((p) => p.category === cat.category).length;
            return (
              <button
                key={cat.category}
                onClick={() => onSelectCategory(cat.category)}
                className="bg-white border border-[#E5E5E5] rounded-[10px] p-4 flex flex-col gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-400 hover:bg-slate-50/50 active:scale-[0.98] transition-all text-left group cursor-pointer"
              >
                <div
                  className="w-10 h-10 bg-slate-50 border border-[#E5E5E5] rounded-[8px] flex items-center justify-center text-slate-700 group-hover:bg-neutral-900 group-hover:text-white transition-colors"
                >
                  <span
                    className="material-symbols-outlined text-[22px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {cat.iconName}
                  </span>
                </div>
                <div>
                  <div className="text-[14px] font-bold text-[#171717]">
                    {cat.category}
                  </div>
                  <div className="text-[12px] text-[#525252] mt-0.5">{countInCat} Records</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Recent Activity Feed */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] md:text-[20px] font-bold text-[#171717] tracking-tight">Recent Activity</h2>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-[#525252] font-semibold">REALTIME FEED</span>
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          </div>
        </div>

        {recentActivities.length === 0 ? (
          <div className="p-8 text-center bg-white border border-[#E5E5E5] rounded-[10px] space-y-2">
            <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center mx-auto text-neutral-400">
              <span className="material-symbols-outlined text-[22px]">history</span>
            </div>
            <div className="text-[14px] font-semibold text-neutral-800">No Recent Activity</div>
            <div className="text-[12px] text-neutral-500 max-w-sm mx-auto">
              Audit log entries will appear here automatically as records, warrants, and case updates are created.
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#E5E5E5] rounded-[10px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col divide-y divide-[#E5E5E5]">
            {recentActivities.map((act) => (
              <div
                key={act.id}
                onClick={() => handleActivityClick(act)}
                className="flex items-start gap-4 p-4 hover:bg-neutral-50 transition-colors cursor-pointer group"
              >
                {act.mugshotUrl ? (
                  <img
                    src={act.mugshotUrl}
                    alt={act.subjectName}
                    className="w-12 h-12 rounded-[8px] object-cover border border-[#E5E5E5] shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-[8px] bg-neutral-100 border border-[#E5E5E5] shrink-0 flex items-center justify-center text-neutral-700">
                    <span className="material-symbols-outlined text-[24px]">person</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-[15px] font-bold text-[#171717] group-hover:underline truncate pr-2">
                      {act.subjectName}
                    </h4>
                    <span className="text-[12px] font-medium text-[#525252] shrink-0">
                      {act.time}
                    </span>
                  </div>
                  <div className="font-mono text-[12px] text-[#525252] mb-2">ID: {act.subjectId}</div>
                  <div>
                    {act.action === 'Warrant Issued' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-red-50 text-red-700 text-[11px] font-semibold border border-red-200 uppercase">
                        Warrant Issued
                      </span>
                    )}
                    {act.action === 'Status Updated' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-slate-50 text-slate-700 text-[11px] font-medium border border-slate-200">
                        Status Updated
                      </span>
                    )}
                    {act.action === 'Case Closed' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
                        Case Closed
                      </span>
                    )}
                    {act.action === 'Evidence Uploaded' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-blue-50 text-blue-700 text-[11px] font-medium border border-blue-200">
                        Evidence Uploaded
                      </span>
                    )}
                    {act.action === 'New Record Created' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] bg-indigo-50 text-indigo-700 text-[11px] font-medium border border-indigo-200">
                        New Record Created
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onViewAllRecords}
          className="w-full mt-4 py-3 border border-[#E5E5E5] rounded-[10px] text-[13px] font-semibold text-[#171717] bg-white hover:bg-neutral-50 transition-colors cursor-pointer text-center shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          View All Database Records &rarr;
        </button>
      </section>
    </div>
  );
};
