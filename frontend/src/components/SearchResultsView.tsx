import React, { useState, useEffect } from 'react';
import { CriminalProfile } from '../types';
import { Search, MapPin, X, SlidersHorizontal, Loader2, ShieldAlert, Filter, Building2, Calendar, UserCheck } from 'lucide-react';
import { api } from '../api';

interface SearchResultsViewProps {
  initialQuery?: string;
  allProfiles: CriminalProfile[];
  onSelectProfile: (profile: CriminalProfile) => void;
  selectedCategoryFilter?: string | null;
  onClearCategoryFilter?: () => void;
}

export const SearchResultsView: React.FC<SearchResultsViewProps> = ({
  initialQuery = '',
  allProfiles,
  onSelectProfile,
  selectedCategoryFilter = null,
  onClearCategoryFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    selectedCategoryFilter ? [selectedCategoryFilter] : []
  );
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['Active']);
  const [locationQuery, setLocationQuery] = useState('');
  const [policeStationQuery, setPoliceStationQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('All');
  const [minAgeInput, setMinAgeInput] = useState<string>('');
  const [maxAgeInput, setMaxAgeInput] = useState<string>('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  
  // Server-Side Search Engine State
  const [searchResults, setSearchResults] = useState<CriminalProfile[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [executionTimeMs, setExecutionTimeMs] = useState<number>(0);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const itemsPerPage = 4;

  // Sync if initialQuery changes
  useEffect(() => {
    if (initialQuery !== undefined) {
      setSearchQuery(initialQuery);
      setCurrentPage(1);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (selectedCategoryFilter) {
      setSelectedCategories([selectedCategoryFilter]);
      setCurrentPage(1);
    }
  }, [selectedCategoryFilter]);

  // Execute Server-Side Search
  const fetchSearchResults = () => {
    let isMounted = true;
    setIsSearching(true);
    setErrorMsg('');

    const minAgeNum = minAgeInput ? parseInt(minAgeInput, 10) : undefined;
    const maxAgeNum = maxAgeInput ? parseInt(maxAgeInput, 10) : undefined;

    api.searchRecords({
      q: searchQuery,
      category: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses.join(',') : undefined,
      location: locationQuery.trim() || undefined,
      policeStation: policeStationQuery.trim() || undefined,
      gender: genderFilter !== 'All' ? genderFilter : undefined,
      minAge: minAgeNum,
      maxAge: maxAgeNum,
      page: currentPage,
      pageSize: itemsPerPage,
    })
      .then((res) => {
        if (isMounted) {
          setSearchResults(res.records || res.results || []);
          setTotalCount(res.totalCount !== undefined ? res.totalCount : (res.total || 0));
          setTotalPages(res.totalPages || 1);
          setExecutionTimeMs(res.executionTimeMs || 0);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMsg(err.message || 'Server search encountered an error.');
          setSearchResults([]);
          setTotalCount(0);
          setTotalPages(1);
        }
      })
      .finally(() => {
        if (isMounted) setIsSearching(false);
      });

    return () => {
      isMounted = false;
    };
  };

  useEffect(() => {
    fetchSearchResults();
  }, [searchQuery, selectedCategories, selectedStatuses, locationQuery, policeStationQuery, genderFilter, minAgeInput, maxAgeInput, currentPage]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setCurrentPage(1);
  };

  const toggleStatus = (st: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st]
    );
    setCurrentPage(1);
  };

  const handleClearAll = () => {
    setSelectedCategories([]);
    setSelectedStatuses([]);
    setLocationQuery('');
    setPoliceStationQuery('');
    setGenderFilter('All');
    setMinAgeInput('');
    setMaxAgeInput('');
    setSearchQuery('');
    setCurrentPage(1);
    if (onClearCategoryFilter) onClearCategoryFilter();
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto w-full">
      {/* Page Header */}
      <div className="border-b border-[#E5E7EB] pb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h1 className="text-[24px] md:text-[28px] font-bold text-neutral-900 tracking-tight">
              Global Search Results
            </h1>
            <p className="text-[14px] md:text-[15px] text-neutral-500 mt-1">
              {totalCount} records found {searchQuery ? <span>for &ldquo;<strong className="text-neutral-800">{searchQuery}</strong>&rdquo;</span> : 'in central database'}{' '}
              {executionTimeMs > 0 && <span className="text-[12px] font-mono text-neutral-400">({executionTimeMs} ms)</span>}
            </p>
          </div>

          {isSearching && (
            <div className="flex items-center gap-2 text-slate-700 text-[13px] font-medium">
              <Loader2 className="w-4 h-4 animate-spin text-slate-900" />
              <span>Querying PostgreSQL Database...</span>
            </div>
          )}
        </div>

        {/* Mobile Search input + Filter pills */}
        <div className="mt-4 md:hidden space-y-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search records..."
              className="w-full h-11 pl-10 pr-9 bg-white rounded-lg border border-[#E5E7EB] text-[14px] text-neutral-900 focus:border-slate-600 outline-none shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Chips (Mobile) */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar py-1">
            <button
              onClick={() => toggleStatus('Active')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-[12px] font-semibold whitespace-nowrap cursor-pointer ${
                selectedStatuses.includes('Active')
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-800 border-[#E5E7EB]'
              }`}
            >
              <span>Status: Active</span>
              {selectedStatuses.includes('Active') && <X className="w-3 h-3" />}
            </button>

            <button
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="flex items-center gap-1 bg-white text-neutral-800 px-3 py-1.5 rounded-full border border-[#E5E7EB] text-[12px] font-semibold whitespace-nowrap cursor-pointer shadow-xs"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>More Filters ({selectedCategories.length + (locationQuery ? 1 : 0) + (policeStationQuery ? 1 : 0)})</span>
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-[13px] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Filters Sidebar (Desktop) / Expandable on Mobile */}
        <aside
          className={`w-full lg:w-64 shrink-0 space-y-6 bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-xs ${
            mobileFilterOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-800" />
              <h3 className="text-[15px] font-bold text-neutral-900">Advanced Filters</h3>
            </div>
            <button
              onClick={handleClearAll}
              className="text-[12px] font-semibold text-neutral-500 hover:text-neutral-900 cursor-pointer underline underline-offset-2"
            >
              Clear All
            </button>
          </div>

          {/* Crime Category */}
          <div>
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
              Crime Category
            </h4>
            <div className="space-y-2">
              {[
                { name: 'Theft' },
                { name: 'Assault' },
                { name: 'Fraud' },
                { name: 'Narcotics' },
                { name: 'Fugitive' },
                { name: 'Vehicle' },
                { name: 'Homicide' },
                { name: 'House Breaking' },
              ].map((cat) => (
                <label
                  key={cat.name}
                  className="flex items-center gap-2.5 cursor-pointer group select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.name)}
                    onChange={() => toggleCategory(cat.name)}
                    className="w-4 h-4 rounded border-[#E5E7EB] text-slate-900 focus:ring-slate-600 cursor-pointer"
                  />
                  <span className="text-[13px] text-neutral-700 group-hover:text-neutral-950 font-medium">
                    {cat.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Case Status */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
              Case Status
            </h4>
            <div className="space-y-2">
              {['Active', 'Closed', 'Warrant Issued', 'Pending Trial'].map((st) => (
                <label
                  key={st}
                  className="flex items-center gap-2.5 cursor-pointer group select-none"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(st)}
                    onChange={() => toggleStatus(st)}
                    className="w-4 h-4 rounded border-[#E5E7EB] text-slate-900 focus:ring-slate-600 cursor-pointer"
                  />
                  <span className="text-[13px] text-neutral-700 group-hover:text-neutral-950 font-medium">
                    {st}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Police Station */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
              Police Precinct
            </h4>
            <div className="relative">
              <Building2 className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={policeStationQuery}
                onChange={(e) => {
                  setPoliceStationQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Station code / precinct"
                className="w-full pl-8 pr-3 py-1.5 border border-[#E5E7EB] rounded-lg text-[13px] text-neutral-900 bg-neutral-50 focus:bg-white focus:border-slate-600 outline-none"
              />
            </div>
          </div>

          {/* Location */}
          <div className="border-t border-[#E5E7EB] pt-4">
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-3">
              Location / Jurisdiction
            </h4>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => {
                  setLocationQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filter by city/region"
                className="w-full pl-8 pr-3 py-1.5 border border-[#E5E7EB] rounded-lg text-[13px] text-neutral-900 bg-neutral-50 focus:bg-white focus:border-slate-600 outline-none"
              />
            </div>
          </div>

          {/* Demographics: Gender & Age Range */}
          <div className="border-t border-[#E5E7EB] pt-4 space-y-3">
            <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Demographics
            </h4>
            <div>
              <label className="block text-[12px] font-medium text-neutral-700 mb-1">Gender</label>
              <select
                value={genderFilter}
                onChange={(e) => {
                  setGenderFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-[13px] text-neutral-900 bg-neutral-50 focus:bg-white outline-none cursor-pointer"
              >
                <option value="All">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-neutral-700 mb-1">Age Range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={minAgeInput}
                  onChange={(e) => {
                    setMinAgeInput(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Min"
                  className="w-1/2 px-2.5 py-1.5 border border-[#E5E7EB] rounded-lg text-[13px] text-neutral-900 bg-neutral-50 focus:bg-white outline-none"
                />
                <span className="text-neutral-400 text-[12px]">-</span>
                <input
                  type="number"
                  value={maxAgeInput}
                  onChange={(e) => {
                    setMaxAgeInput(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Max"
                  className="w-1/2 px-2.5 py-1.5 border border-[#E5E7EB] rounded-lg text-[13px] text-neutral-900 bg-neutral-50 focus:bg-white outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-[#E5E7EB] pt-4 flex gap-2">
            <button
              onClick={() => {
                setCurrentPage(1);
                fetchSearchResults();
              }}
              className="flex-1 py-2 bg-neutral-900 hover:bg-black text-white text-[12px] font-semibold rounded-lg cursor-pointer transition-colors text-center shadow-xs"
            >
              Apply Filters
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-2 bg-white hover:bg-neutral-50 border border-[#E5E7EB] text-neutral-700 text-[12px] font-semibold rounded-lg cursor-pointer transition-colors"
            >
              Reset
            </button>
          </div>
        </aside>

        {/* Results List */}
        <div className="flex-1 w-full">
          {/* Table Header (Desktop) */}
          <div className="hidden md:grid grid-cols-12 gap-4 bg-[#F8F9FA] px-4 py-2.5 border border-[#E5E7EB] rounded-t-xl text-[11px] font-bold text-neutral-600 uppercase tracking-wider">
            <div className="col-span-4">Subject Details</div>
            <div className="col-span-3">Background Info</div>
            <div className="col-span-3">Record Stats</div>
            <div className="col-span-2 text-right">Action</div>
          </div>

          {/* Records Container */}
          <div className="bg-white border md:border-t-0 border-[#E5E7EB] rounded-xl md:rounded-t-none divide-y divide-[#E5E7EB] overflow-hidden shadow-xs">
            {isSearching ? (
              <div className="p-12 text-center text-neutral-500 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-900" />
                <p className="text-[14px] font-medium text-neutral-700">Executing database query across records...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-12 text-center text-neutral-500">
                <span className="material-symbols-outlined text-[48px] text-neutral-400 mb-2">
                  person_off
                </span>
                <h3 className="text-[16px] font-bold text-neutral-900">No Results Found</h3>
                <p className="text-[13px] mt-1">Try relaxing your filter criteria or clearing search queries.</p>
                <button
                  onClick={handleClearAll}
                  className="mt-4 px-4 py-2 bg-neutral-900 hover:bg-black text-white text-[12px] font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              searchResults.map((profile, idx) => (
                <div
                  key={profile.id}
                  className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 hover:bg-neutral-50 transition-colors items-center group ${
                    idx % 2 === 1 ? 'bg-[#FAFAFA]' : 'bg-white'
                  }`}
                >
                  {/* Subject Details */}
                  <div className="col-span-1 md:col-span-4 flex items-center gap-4">
                    {profile.mugshotUrl ? (
                      <img
                        src={profile.mugshotUrl}
                        alt={profile.name}
                        className="w-12 h-12 md:w-14 md:h-14 object-cover rounded-lg border border-[#E5E7EB] shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 md:w-14 md:h-14 rounded-lg border border-[#E5E7EB] bg-neutral-100 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-neutral-500">person</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-[15px] md:text-[16px] font-bold text-neutral-900 mb-0.5 truncate">
                        {profile.name}
                      </h4>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded-md border border-neutral-200 font-semibold">
                          {profile.id}
                        </span>
                        {profile.riskLevel === 'High Risk' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 uppercase tracking-wider border border-red-200">
                            High Risk
                          </span>
                        )}
                        {profile.status === 'Warrant Issued' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-red-700 uppercase tracking-wider border border-red-200">
                            Warrant
                          </span>
                        )}
                        {profile.status === 'Probation' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-50 text-slate-700 border border-slate-200">
                            Probation
                          </span>
                        )}
                        {profile.status === 'Cleared' && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Cleared
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Background Info */}
                  <div className="col-span-1 md:col-span-3 text-[13px] text-neutral-700">
                    <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
                      <span className="text-neutral-400 text-[11px] font-bold uppercase self-center">
                        Father:
                      </span>
                      <span className="truncate font-medium text-neutral-800">{profile.fatherName || 'Unknown'}</span>
                      <span className="text-neutral-400 text-[11px] font-bold uppercase self-center">
                        Address:
                      </span>
                      <span className="truncate text-neutral-600">{profile.city}, {profile.state}</span>
                    </div>
                  </div>

                  {/* Record Stats */}
                  <div className="col-span-1 md:col-span-3 flex flex-col gap-1 text-[13px]">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-neutral-400 uppercase">
                        Category:
                      </span>
                      <span className="text-[13px] font-bold text-neutral-900">{profile.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-neutral-800">
                        {profile.totalCases} {profile.totalCases === 1 ? 'Case' : 'Cases'}
                      </span>
                      <span className="text-neutral-300">•</span>
                      <span
                        className={`font-semibold ${
                          profile.activeCasesCount > 0 ? 'text-red-700' : 'text-neutral-500'
                        }`}
                      >
                        {profile.activeCasesCount} Active
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="col-span-1 md:col-span-2 flex md:justify-end mt-1 md:mt-0">
                    <button
                      onClick={() => onSelectProfile(profile)}
                      className="w-full md:w-auto bg-white border border-[#E5E7EB] text-neutral-900 font-semibold text-[12px] px-4 py-2 rounded-lg hover:border-slate-800 hover:bg-neutral-900 hover:text-white transition-all cursor-pointer text-center shadow-xs"
                    >
                      View Record
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Server-Side Pagination Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 px-2">
            <span className="text-[13px] text-neutral-500">
              Showing {totalCount > 0 ? Math.min(totalCount, (currentPage - 1) * itemsPerPage + 1) : 0}-
              {Math.min(totalCount, currentPage * itemsPerPage)} of {totalCount} database results
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isSearching}
                className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-[12px] font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer bg-white"
              >
                &lt; Prev
              </button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    disabled={isSearching}
                    className={`px-3 py-1.5 border rounded-lg text-[12px] font-semibold cursor-pointer ${
                      currentPage === pageNum
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-[#E5E7EB] text-neutral-700 bg-white hover:bg-neutral-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || isSearching}
                className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-[12px] font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer bg-white"
              >
                Next &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
