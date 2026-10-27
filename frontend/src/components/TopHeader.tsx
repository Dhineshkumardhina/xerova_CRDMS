import React, { useState } from 'react';
import { Officer, CriminalProfile } from '../types';
import { Search, Bell, User, LogOut, X } from 'lucide-react';

interface TopHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (query: string) => void;
  onSelectProfile: (profile: CriminalProfile) => void;
  allProfiles: CriminalProfile[];
  officer: Officer;
  onLogout: () => void;
  isOffline: boolean;
  onToggleOffline: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onSelectProfile,
  allProfiles,
  officer,
  onLogout,
  isOffline,
  onToggleOffline,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const filteredQuickResults = searchQuery.trim()
    ? allProfiles.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.identificationNumber.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchSubmit(searchQuery);
      setIsSearchFocused(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex justify-between items-center w-full px-6 py-2.5 min-h-[60px] bg-white border-b border-[#E5E7EB] select-none shadow-xs">
      {/* Search Bar */}
      <div className="flex-1 max-w-md relative">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Search profiles, IDs, cases, plates..."
            className="w-full bg-[#F5F6F8] border border-[#E5E7EB] rounded-lg pl-9 pr-8 py-2 text-[13px] text-neutral-900 placeholder:text-neutral-500 focus:bg-white focus:border-slate-600 focus:ring-1 focus:ring-slate-600 outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 text-neutral-400 hover:text-neutral-800 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Live Search Autocomplete Dropdown */}
        {isSearchFocused && filteredQuickResults.length > 0 && (
          <div
            className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden z-50 divide-y divide-[#E5E7EB]"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="px-3.5 py-2 bg-[#F8F9FA] text-[11px] font-bold text-neutral-600 uppercase tracking-wider flex justify-between items-center">
              <span>Quick Matches ({filteredQuickResults.length})</span>
              <span className="text-[10px] font-normal text-neutral-400 lowercase">press enter for all</span>
            </div>
            {filteredQuickResults.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  onSelectProfile(p);
                  setIsSearchFocused(false);
                }}
                className="w-full px-3.5 py-2.5 text-left hover:bg-neutral-50 flex items-center gap-3 transition-colors cursor-pointer"
              >
                <img
                  src={p.mugshotUrl}
                  alt={p.name}
                  className="w-9 h-9 rounded-md object-cover border border-[#E5E7EB] shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-bold text-neutral-900 truncate flex items-center gap-2">
                    {p.name}
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                      {p.id}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                    {p.category} • {p.city}, {p.state} • <span className="font-medium text-neutral-700">{p.status}</span>
                  </div>
                </div>
              </button>
            ))}
            <button
              onClick={() => {
                onSearchSubmit(searchQuery);
                setIsSearchFocused(false);
              }}
              className="w-full px-3 py-2 text-center text-[12px] font-semibold text-neutral-900 bg-[#F8F9FA] hover:bg-neutral-200/70 transition-colors cursor-pointer"
            >
              View all results for &quot;{searchQuery}&quot; &rarr;
            </button>
          </div>
        )}
      </div>

      {/* Trailing Controls & User Info */}
      <div className="flex items-center gap-3 text-neutral-600">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="hover:bg-neutral-100 p-2 rounded-lg transition-colors flex items-center justify-center text-neutral-700 relative cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E5E7EB] rounded-xl shadow-xl py-2 z-50">
              <div className="px-4 py-2.5 border-b border-[#E5E7EB] flex justify-between items-center bg-[#F8F9FA]">
                <span className="text-[12px] font-bold text-neutral-900 uppercase tracking-wider">
                  System Alerts
                </span>
                <span className="text-[10px] font-mono text-neutral-500 font-semibold">Realtime Feed</span>
              </div>
              <div className="p-6 text-center text-neutral-500">
                <Bell className="w-7 h-7 text-neutral-300 mx-auto mb-2" />
                <div className="text-[13px] font-semibold text-neutral-800">No Active Alerts</div>
                <p className="text-[11px] text-neutral-400 mt-0.5">All monitored systems and warrants are operational.</p>
              </div>
            </div>
          )}
        </div>

        {/* Account Details / Avatar */}
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="hover:ring-2 hover:ring-neutral-400 p-0.5 rounded-full transition-all flex items-center justify-center cursor-pointer"
            aria-label="User profile"
          >
            <img
              src={officer.avatarUrl}
              alt="Officer profile"
              className="w-7 h-7 rounded-full object-cover border border-[#E5E7EB]"
            />
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E5E7EB] rounded-xl shadow-xl p-3.5 z-50">
              <div className="flex items-center gap-3 pb-3 border-b border-[#E5E7EB]">
                <img
                  src={officer.avatarUrl}
                  alt={officer.name}
                  className="w-10 h-10 rounded-full object-cover border border-[#E5E7EB]"
                />
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-neutral-900 truncate">{officer.name}</div>
                  <div className="text-[11px] text-neutral-500">Badge #{officer.badgeNumber}</div>
                  <div className="text-[10px] text-neutral-600 truncate">{officer.department}</div>
                </div>
              </div>
              <div className="py-2.5 text-[11px] text-neutral-600 space-y-1">
                <div>Clearance: <strong className="text-neutral-900 font-semibold">{officer.clearanceLevel}</strong></div>
                <div>Session: <strong className="text-emerald-700 font-medium">Active Encrypted TLS</strong></div>
              </div>
              <button
                onClick={onLogout}
                className="w-full mt-2 pt-2.5 border-t border-[#E5E7EB] text-left text-[12px] font-semibold text-red-600 flex items-center gap-2 hover:underline cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out Session
              </button>
            </div>
          )}
        </div>

        <div className="w-[1px] h-5 bg-[#E5E7EB] mx-1" />

        {/* Direct Logout Icon */}
        <button
          onClick={onLogout}
          className="hover:bg-neutral-100 p-2 rounded-lg transition-colors flex items-center justify-center text-neutral-600 hover:text-red-600 cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
