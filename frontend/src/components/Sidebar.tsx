import React from 'react';
import { ActiveTab, Officer } from '../types';
import { Plus } from 'lucide-react';

interface SidebarProps {
  currentTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenNewRecord: () => void;
  onLogout: () => void;
  officer: Officer;
  isOffline: boolean;
  onToggleOffline: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenNewRecord,
  onLogout,
  officer,
  isOffline,
  onToggleOffline,
}) => {
  const isSuperAdmin = Boolean(
    officer.isSuperuser ||
    officer.role === 'Super Administrator' ||
    officer.role === 'Super Admin' ||
    officer.role === 'Administrator' ||
    officer.badgeNumber === '8829-JD'
  );

  const canAddCriminal = Boolean(
    isSuperAdmin ||
    officer.canCreateCriminals ||
    officer.role?.toLowerCase().includes('admin')
  );

  const navItems: Array<{ id: ActiveTab; label: string; icon: string }> = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'search', label: 'Search', icon: 'manage_search' },
    { id: 'criminals', label: 'Criminals', icon: 'person_search' },
    { id: 'categories', label: 'Categories', icon: 'folder_shared' },
    { id: 'cases', label: 'Cases', icon: 'gavel' },
    { id: 'reports', label: 'Reports', icon: 'description' },
    ...(isSuperAdmin
      ? [{ id: 'admin' as ActiveTab, label: 'Admin Hierarchy', icon: 'admin_panel_settings' }]
      : []),
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <aside className="hidden md:flex flex-col bg-[#F3F3F4] border-r border-[#E5E5E5] w-[260px] h-screen fixed left-0 top-0 py-6 gap-4 z-40 select-none text-[#525252]">
      {/* Brand & Officer Header */}
      <div className="px-5 flex flex-col gap-1 mb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#3B5B7A] text-white flex items-center justify-center shadow-xs">
              <span
                className="material-symbols-outlined text-[19px] fill-1 text-white"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                shield
              </span>
            </div>
            <h2 className="text-[20px] font-bold text-[#171717] tracking-tight">CRMS</h2>
          </div>
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-neutral-200/80 text-[#525252] border border-neutral-300/80">
            v2.4.1
          </span>
        </div>

        <div className="flex items-center gap-3 mt-3.5 p-2.5 rounded-[10px] bg-white border border-[#E5E5E5] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center overflow-hidden border border-[#E5E5E5] shrink-0">
            <img
              src={officer.avatarUrl}
              alt="Officer ID badge"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-bold text-[#171717] truncate">
              Officer ID: {officer.badgeNumber}
            </span>
            <span className="text-[11px] text-[#525252] truncate">
              {officer.rank.split(' ')[0]} • Authorized
            </span>
          </div>
        </div>

        {canAddCriminal && (
          <button
            onClick={onOpenNewRecord}
            className="mt-3 w-full bg-[#171717] text-white hover:bg-black text-[12px] font-semibold py-2.5 px-3 rounded-[8px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>New Record</span>
          </button>
        )}
      </div>

      {/* Primary Nav Tabs */}
      <div className="flex-1 px-3 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] text-[13px] transition-all text-left cursor-pointer ${
                isActive
                  ? 'bg-white text-[#171717] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-[#E5E5E5]'
                  : 'text-[#525252] hover:bg-neutral-200/60 hover:text-[#171717]'
              }`}
            >
              {/* Subtle slate-blue active indicator strip */}
              {isActive && (
                <span className="absolute left-1.5 top-2.5 bottom-2.5 w-1 bg-[#3B5B7A] rounded-full" />
              )}
              <span
                className={`material-symbols-outlined text-[20px] transition-colors ${
                  isActive ? 'text-[#3B5B7A] ml-1' : 'text-[#525252]'
                }`}
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>
              <span className="flex-1 truncate">{item.label}</span>
              {item.id === 'search' && (
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-semibold ${
                    isActive ? 'bg-[#3B5B7A] text-white' : 'bg-neutral-200/80 text-[#525252]'
                  }`}
                >
                  42
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Nav */}
      <div className="px-3 flex flex-col gap-1.5 mt-auto pt-3 border-t border-[#E5E5E5]">
        <button
          onClick={() => onSelectTab('support')}
          className="flex items-center gap-3 px-3 py-2 rounded-[8px] text-[#525252] hover:bg-neutral-200/60 hover:text-[#171717] transition-all text-[12px] font-medium text-left cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">help_outline</span>
          Support &amp; Lexicon
        </button>

        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2 rounded-[8px] text-[#525252] hover:text-red-700 hover:bg-red-50/80 transition-all text-[12px] font-medium text-left cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Logout
        </button>
      </div>
    </aside>
  );
};
