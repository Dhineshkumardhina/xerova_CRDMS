import React from 'react';
import { ActiveTab, Officer } from '../types';
import { Shield, Bell, User, ArrowLeft, MoreVertical } from 'lucide-react';

interface MobileNavBarProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  officer: Officer;
  isSubPage?: boolean;
  subPageTitle?: string;
  onBack?: () => void;
}

export const MobileNavBar: React.FC<MobileNavBarProps> = ({
  currentTab,
  onSelectTab,
  officer,
  isSubPage = false,
  subPageTitle = '',
  onBack,
}) => {
  const bottomTabs: Array<{ id: ActiveTab; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'search', label: 'Search', icon: 'manage_search' },
    { id: 'criminals', label: 'Criminals', icon: 'person_search' },
    { id: 'cases', label: 'Cases', icon: 'gavel' },
  ];

  return (
    <>
      {/* Mobile Top App Bar */}
      <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E5E7EB] px-4 h-[56px] flex items-center justify-between select-none shadow-xs">
        {isSubPage ? (
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 -ml-1 text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-[17px] font-bold text-neutral-900 tracking-tight truncate">
              {subPageTitle || 'Dossier View'}
            </h1>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-neutral-900 font-bold text-[19px] tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                shield
              </span>
            </div>
            <span>CRMS</span>
          </div>
        )}

        <div className="flex items-center gap-2.5 text-neutral-600">
          {isSubPage ? (
            <button
              onClick={() => alert('Dossier Actions: Export PDF, Print Warrant, Link External Evidence.')}
              className="p-1.5 hover:bg-neutral-100 rounded-lg cursor-pointer text-neutral-800"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
          ) : (
            <>
              <button
                onClick={() => onSelectTab('search')}
                className="hover:bg-neutral-100 p-1.5 rounded-lg transition-colors text-neutral-600 hover:text-neutral-900 cursor-pointer"
                aria-label="Search"
              >
                <span className="material-symbols-outlined text-[20px]">search</span>
              </button>
              <button
                onClick={() => alert('3 Active System Alerts: 1 Federal Warrant, 1 Lab Analysis, 1 Case Closed.')}
                className="hover:bg-neutral-100 p-1.5 rounded-lg transition-colors text-neutral-600 hover:text-neutral-900 relative cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
              </button>
              <div className="w-7 h-7 rounded-full overflow-hidden border border-[#E5E7EB]">
                <img
                  src={officer.avatarUrl}
                  alt={officer.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </>
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-[#E5E7EB] h-[64px] flex justify-around items-center px-1 z-40 shadow-lg pb-safe select-none">
        {bottomTabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all cursor-pointer ${
                isActive ? 'text-slate-900 font-bold' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <div
                className={`flex items-center justify-center rounded-xl px-3 py-1 transition-colors ${
                  isActive ? 'bg-slate-900 text-white' : ''
                }`}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {tab.icon}
                </span>
              </div>
              <span className="text-[10px] mt-0.5 font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
