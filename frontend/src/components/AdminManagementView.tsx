import React, { useState, useEffect, useMemo } from 'react';
import { Officer, PermissionGrantItem } from '../types';
import { api } from '../api';
import {
  ShieldCheck,
  UserPlus,
  Users,
  Key,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  RefreshCw,
  Building,
  MapPin,
  BadgeCheck,
  History,
  Lock,
  UserCheck,
  UserX,
  X,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

interface AdminManagementViewProps {
  currentOfficer: Officer;
}

export const AdminManagementView: React.FC<AdminManagementViewProps> = ({ currentOfficer }) => {
  const isSuperAdmin = Boolean(
    currentOfficer.isSuperuser ||
    currentOfficer.role === 'Super Administrator' ||
    currentOfficer.role === 'Super Admin' ||
    currentOfficer.role === 'Administrator' ||
    currentOfficer.badgeNumber === '8829-JD'
  );

  const [users, setUsers] = useState<Officer[]>([]);
  const [grants, setGrants] = useState<PermissionGrantItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterRole, setFilterRole] = useState<'ALL' | 'REGIONAL_ADMIN' | 'OFFICER' | 'AUTHORIZED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Dialog States
  const [isAddRegionalModalOpen, setIsAddRegionalModalOpen] = useState(false);
  const [isAddOfficerModalOpen, setIsAddOfficerModalOpen] = useState(false);
  const [isAuditHistoryOpen, setIsAuditHistoryOpen] = useState(false);

  // Form State: Add Regional Admin
  const [radmUsername, setRadmUsername] = useState('');
  const [radmPassword, setRadmPassword] = useState('SecurePass#2026');
  const [showRadmPassword, setShowRadmPassword] = useState(false);
  const [radmFullName, setRadmFullName] = useState('');
  const [radmBadge, setRadmBadge] = useState('');
  const [radmRegion, setRadmRegion] = useState('North Region');

  // Form State: Add Police Member
  const [offUsername, setOffUsername] = useState('');
  const [offPassword, setOffPassword] = useState('SecurePass#2026');
  const [showOffPassword, setShowOffPassword] = useState(false);
  const [offFullName, setOffFullName] = useState('');
  const [offBadge, setOffBadge] = useState('');
  const [offRegion, setOffRegion] = useState('North Region');
  const [offRank, setOffRank] = useState('Patrol Officer');
  const [offGrantCreateRight, setOffGrantCreateRight] = useState(false);

  // Form submission loading
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedUsers, fetchedGrants] = await Promise.all([
        api.getOfficers(),
        api.getCriminalPermissionGrants()
      ]);
      setUsers(fetchedUsers);
      setGrants(fetchedGrants);
    } catch (err: any) {
      console.warn('Failed to fetch administrative data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      loadData();
    }
  }, [isSuperAdmin]);

  const showNotification = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Helper to check active status cleanly
  const isUserActive = (u: Officer) => {
    if (u.isActive !== undefined) return Boolean(u.isActive);
    if (u.status) {
      const s = String(u.status).toLowerCase();
      return s === 'active' || s === 'on duty' || s === 'true';
    }
    return true;
  };

  // Submit: Add Regional Admin
  const handleAddRegionalAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.createUser({
        username: radmUsername.trim(),
        password: radmPassword || 'SecurePass#2026',
        fullName: radmFullName.trim(),
        badgeNumber: radmBadge.trim(),
        roleName: 'Regional Administrator',
        region: radmRegion,
        rank: 'Regional Commissioner',
        department: 'Regional Command Center',
        clearanceLevel: 'Level 4 - Secret'
      });
      showNotification('success', `Regional Admin "${radmFullName}" provisioned for ${radmRegion}.`);
      setRadmUsername('');
      setRadmFullName('');
      setRadmBadge('');
      setIsAddRegionalModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to create Regional Admin');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit: Add Police Member
  const handleAddPoliceMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newOfficer = await api.createUser({
        username: offUsername.trim(),
        password: offPassword || 'SecurePass#2026',
        fullName: offFullName.trim(),
        badgeNumber: offBadge.trim(),
        roleName: 'Officer',
        region: offRegion,
        rank: offRank,
        department: 'Field Policing & Patrol',
        clearanceLevel: 'Level 2 - Confidential'
      });

      if (offGrantCreateRight && newOfficer?.id) {
        await api.grantCriminalRecordPermission(
          newOfficer.id,
          true,
          'Granted by Super Admin during user onboarding'
        );
      }

      showNotification(
        'success',
        `Police Member "${offFullName}" registered in ${offRegion}.${
          offGrantCreateRight ? ' (Criminal creation authorized)' : ' (Read-only search by default)'
        }`
      );
      setOffUsername('');
      setOffFullName('');
      setOffBadge('');
      setOffGrantCreateRight(false);
      setIsAddOfficerModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to create police member');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Criminal Record Creation Permission
  const handleToggleCriminalPermission = async (targetUser: Officer) => {
    try {
      const nextGranted = !targetUser.canCreateCriminals;
      await api.grantCriminalRecordPermission(
        targetUser.id,
        nextGranted,
        nextGranted ? 'Authorized by Super Admin' : 'Revoked by Super Admin'
      );
      showNotification(
        'success',
        `Criminal record creation rights for ${targetUser.name} ${
          nextGranted ? 'GRANTED' : 'REVOKED'
        }.`
      );
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update permission');
    }
  };

  // Toggle Account Active / Suspended Status
  const handleToggleStatus = async (targetUser: Officer) => {
    try {
      const currentActive = isUserActive(targetUser);
      const nextActive = !currentActive;
      await api.updateUser(targetUser.id, { isActive: nextActive });
      showNotification(
        'success',
        `User ${targetUser.name} (${targetUser.badgeNumber}) ${
          nextActive ? 'ACTIVATED' : 'SUSPENDED'
        }.`
      );
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update status');
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (filterRole === 'REGIONAL_ADMIN') {
        if (u.role !== 'Regional Administrator' && u.role !== 'Regional Admin') return false;
      } else if (filterRole === 'OFFICER') {
        if (u.role === 'Regional Administrator' || u.role === 'Super Administrator' || u.isSuperuser) return false;
      } else if (filterRole === 'AUTHORIZED') {
        if (!u.canCreateCriminals) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = u.name.toLowerCase().includes(q);
        const matchesBadge = u.badgeNumber.toLowerCase().includes(q);
        const matchesRegion = (u.region || '').toLowerCase().includes(q);
        const matchesRole = (u.role || '').toLowerCase().includes(q);
        if (!matchesName && !matchesBadge && !matchesRegion && !matchesRole) return false;
      }

      return true;
    });
  }, [users, filterRole, searchQuery]);

  // Statistics
  const totalUsersCount = users.length;
  const regionalAdminsCount = users.filter(
    (u) => u.role === 'Regional Administrator' || u.role === 'Regional Admin'
  ).length;
  const policeOfficersCount = users.filter(
    (u) => u.role !== 'Regional Administrator' && u.role !== 'Regional Admin' && !u.isSuperuser
  ).length;
  const authorizedCreatorsCount = users.filter((u) => Boolean(u.canCreateCriminals)).length;

  if (!isSuperAdmin) {
    return (
      <div className="bg-white border border-[#E5E5E5] rounded-[16px] p-12 text-center shadow-xs max-w-lg mx-auto my-12 space-y-4">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-600">
          <Lock className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-[20px] font-bold text-neutral-900">Restricted Super Admin Area</h2>
          <p className="text-[13px] text-neutral-500 mt-2">
            Access Denied. Only the Super Administrator account (<span className="font-mono font-semibold text-neutral-800">8829-JD</span>) is authorized to access the Administrative Hierarchy and User Management Portal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto w-full">
      {/* 1. Header with Title & Primary Action Buttons */}
      <div className="bg-white border border-[#E5E5E5] rounded-[16px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#3B5B7A]/10 text-[#3B5B7A] border border-[#3B5B7A]/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              Super Admin Authority • Badge #{currentOfficer.badgeNumber}
            </span>
          </div>
          <h1 className="text-[24px] md:text-[28px] font-bold text-neutral-900 tracking-tight">
            User &amp; Access Management
          </h1>
          <p className="text-[13px] md:text-[14px] text-neutral-500 mt-0.5">
            Manage Regional Administrators, register police members, assign regional jurisdictions, and grant criminal data creation rights.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsAddRegionalModalOpen(true)}
            className="bg-[#3B5B7A] hover:bg-[#2F4962] text-white text-[12px] font-semibold px-4 py-2.5 rounded-[10px] flex items-center gap-2 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
          >
            <Building className="w-4 h-4" />
            <span>+ Add Regional Admin</span>
          </button>

          <button
            onClick={() => setIsAddOfficerModalOpen(true)}
            className="bg-[#171717] hover:bg-black text-white text-[12px] font-semibold px-4 py-2.5 rounded-[10px] flex items-center gap-2 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Police Officer</span>
          </button>

          <button
            onClick={loadData}
            title="Refresh Personnel Directory"
            className="p-2.5 bg-neutral-100 hover:bg-neutral-200 border border-[#E5E5E5] rounded-[10px] text-neutral-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-[13px] font-semibold shadow-xs transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* 2. Key Metrics Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Total Personnel */}
        <div className="bg-white border border-[#E5E5E5] rounded-[14px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Personnel</span>
            <Users className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-[24px] font-bold text-neutral-900">{totalUsersCount}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Active in system</div>
        </div>

        {/* Card 2: Regional Admins */}
        <div className="bg-white border border-[#E5E5E5] rounded-[14px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Regional Admins</span>
            <Building className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-[24px] font-bold text-neutral-900">{regionalAdminsCount}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Assigned to regions</div>
        </div>

        {/* Card 3: Field Officers */}
        <div className="bg-white border border-[#E5E5E5] rounded-[14px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Police Members</span>
            <UserCheck className="w-4 h-4 text-[#3B5B7A]" />
          </div>
          <div className="text-[24px] font-bold text-neutral-900">{policeOfficersCount}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Field officers &amp; detectives</div>
        </div>

        {/* Card 4: Record Creation Rights */}
        <div className="bg-white border border-[#E5E5E5] rounded-[14px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between text-neutral-500 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Creation Rights</span>
            <Key className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-[24px] font-bold text-emerald-700">{authorizedCreatorsCount}</div>
          <div className="text-[11px] text-neutral-400 mt-0.5">Authorized accounts</div>
        </div>
      </div>

      {/* 3. Personnel Directory & Controls (Main Spacious Table) */}
      <div className="bg-white border border-[#E5E5E5] rounded-[16px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Table Filter & Search Controls */}
        <div className="p-4 md:p-5 border-b border-[#E5E5E5] flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-50/50">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setFilterRole('ALL')}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all cursor-pointer ${
                filterRole === 'ALL'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-[#E5E5E5]'
              }`}
            >
              All Personnel ({users.length})
            </button>
            <button
              onClick={() => setFilterRole('REGIONAL_ADMIN')}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all cursor-pointer ${
                filterRole === 'REGIONAL_ADMIN'
                  ? 'bg-purple-800 text-white shadow-xs'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-[#E5E5E5]'
              }`}
            >
              Regional Admins ({regionalAdminsCount})
            </button>
            <button
              onClick={() => setFilterRole('OFFICER')}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all cursor-pointer ${
                filterRole === 'OFFICER'
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-white text-neutral-600 hover:bg-neutral-100 border border-[#E5E5E5]'
              }`}
            >
              Police Members ({policeOfficersCount})
            </button>
            <button
              onClick={() => setFilterRole('AUTHORIZED')}
              className={`px-3 py-1.5 rounded-[8px] text-[12px] font-semibold transition-all cursor-pointer ${
                filterRole === 'AUTHORIZED'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              Can Create Criminal Records ({authorizedCreatorsCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, badge, region..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-[#E5E5E5] rounded-[8px] text-[12px] focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-[#E5E5E5]">
              <tr>
                <th className="px-5 py-3.5">Officer / Personnel</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Assigned Jurisdiction</th>
                <th className="px-5 py-3.5">Criminal Record Creation</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-neutral-400">
                    No personnel found matching the current search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSuper = Boolean(
                    u.isSuperuser ||
                    u.role === 'Super Administrator' ||
                    u.role === 'Super Admin' ||
                    u.badgeNumber === '8829-JD'
                  );
                  const isRadm = u.role === 'Regional Administrator' || u.role === 'Regional Admin';
                  const canCreate = Boolean(u.canCreateCriminals);
                  const active = isUserActive(u);

                  return (
                    <tr key={u.id} className="hover:bg-neutral-50/70 transition-colors">
                      {/* Officer Profile */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256"}
                            alt={u.name}
                            className="w-9 h-9 rounded-full object-cover border border-[#E5E5E5] shrink-0"
                          />
                          <div>
                            <div className="font-bold text-neutral-900">{u.name}</div>
                            <div className="text-[11px] text-neutral-500 font-mono">
                              Badge: #{u.badgeNumber} {u.department ? `• ${u.department}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-3.5">
                        {isSuper ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-900 text-white">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Super Admin</span>
                          </span>
                        ) : isRadm ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                            <Building className="w-3.5 h-3.5 text-purple-600" />
                            <span>Regional Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                            <span>{u.rank || 'Police Member'}</span>
                          </span>
                        )}
                      </td>

                      {/* Region */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 text-neutral-800 font-medium text-[12px]">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span>{u.region || (isSuper ? 'Global (All Regions)' : 'North Region')}</span>
                        </div>
                      </td>

                      {/* Criminal Record Creation Right */}
                      <td className="px-5 py-3.5">
                        {isSuper ? (
                          <span className="inline-flex items-center gap-1.5 text-[#3B5B7A] font-bold text-[12px]">
                            <BadgeCheck className="w-4 h-4" />
                            <span>Global Authority</span>
                          </span>
                        ) : (
                          <div className="flex items-center gap-2">
                            {canCreate ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-md text-[11px] border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Authorized</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-neutral-500 font-medium bg-neutral-100 px-2.5 py-1 rounded-md text-[11px] border border-neutral-200">
                                <XCircle className="w-3.5 h-3.5 text-neutral-400" />
                                <span>Read-Only (Default)</span>
                              </span>
                            )}

                            {/* Easy Toggle Button */}
                            <button
                              type="button"
                              onClick={() => handleToggleCriminalPermission(u)}
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer border ${
                                canCreate
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                              }`}
                              title={canCreate ? 'Revoke criminal-record creation rights' : 'Grant criminal-record creation rights'}
                            >
                              {canCreate ? 'Revoke Rights' : 'Grant Rights'}
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Account Status */}
                      <td className="px-5 py-3.5">
                        {active ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold text-[12px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-rose-600 font-semibold text-[12px]">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span>Suspended</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        {isSuper ? (
                          <span className="text-[11px] text-neutral-400 italic">Protected (Self)</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(u)}
                            className={`px-3 py-1.5 rounded-[8px] text-[11px] font-semibold transition-all cursor-pointer border ${
                              active
                                ? 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-200 shadow-xs'
                                : 'bg-slate-900 text-white hover:bg-black border-slate-900'
                            }`}
                          >
                            {active ? 'Suspend Account' : 'Activate Account'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Collapsible Authorization & Audit History */}
      <div className="bg-white border border-[#E5E5E5] rounded-[16px] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <button
          type="button"
          onClick={() => setIsAuditHistoryOpen(!isAuditHistoryOpen)}
          className="w-full flex items-center justify-between text-left cursor-pointer group"
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#3B5B7A]" />
            <span className="text-[14px] font-bold text-neutral-900 group-hover:text-black">
              Permission Grant &amp; Revocation History ({grants.length})
            </span>
          </div>
          <div className="flex items-center gap-1 text-[12px] text-neutral-500">
            <span>{isAuditHistoryOpen ? 'Hide History' : 'View History'}</span>
            {isAuditHistoryOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {isAuditHistoryOpen && (
          <div className="mt-4 pt-4 border-t border-[#E5E5E5] overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-[#E5E5E5]">
                <tr>
                  <th className="px-3 py-2">Target Officer</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Authorized By</th>
                  <th className="px-3 py-2">Reason / Justification</th>
                  <th className="px-3 py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {grants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-neutral-400">
                      No explicit permission modifications recorded yet.
                    </td>
                  </tr>
                ) : (
                  grants.map((g) => (
                    <tr key={g.id} className="hover:bg-neutral-50/60">
                      <td className="px-3 py-2 font-bold text-neutral-900">{g.officerName}</td>
                      <td className="px-3 py-2">
                        {g.isGranted ? (
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                            Permission Granted
                          </span>
                        ) : (
                          <span className="text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded text-[11px] border border-rose-200">
                            Permission Revoked
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-neutral-700">{g.grantedByName || 'Super Admin'}</td>
                      <td className="px-3 py-2 text-neutral-600">{g.reason || 'Super Admin Operational Authorization'}</td>
                      <td className="px-3 py-2 text-neutral-400 font-mono text-[11px]">
                        {g.grantedAt?.slice(0, 19) || 'Recent'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: ADD REGIONAL ADMINISTRATOR                           */}
      {/* ============================================================== */}
      {isAddRegionalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[20px] max-w-lg w-full p-6 shadow-2xl border border-[#E5E5E5] space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#E5E5E5] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-neutral-900">Provision Regional Admin</h3>
                  <p className="text-[12px] text-neutral-500">
                    Assign a Regional Administrator to oversee police members in their jurisdiction.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddRegionalModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddRegionalAdmin} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-neutral-700 mb-1">
                  Full Name / Title
                </label>
                <input
                  type="text"
                  required
                  value={radmFullName}
                  onChange={(e) => setRadmFullName(e.target.value)}
                  placeholder="e.g. Commissioner Rajesh Sharma"
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[13px] focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-700 mb-1">
                    Username / Officer ID
                  </label>
                  <input
                    type="text"
                    required
                    value={radmUsername}
                    onChange={(e) => setRadmUsername(e.target.value)}
                    placeholder="e.g. radm_north"
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[13px] focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-700 mb-1">
                    Badge Number
                  </label>
                  <input
                    type="text"
                    required
                    value={radmBadge}
                    onChange={(e) => setRadmBadge(e.target.value)}
                    placeholder="e.g. RADM-9100"
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[13px] focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-700 mb-1">
                  Authorized Regional Jurisdiction
                </label>
                <select
                  value={radmRegion}
                  onChange={(e) => setRadmRegion(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[13px] focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
                >
                  <option value="North Region">North Region</option>
                  <option value="South Region">South Region</option>
                  <option value="East Region">East Region</option>
                  <option value="West Region">West Region</option>
                  <option value="Central Region">Central Region</option>
                </select>
                <p className="text-[11px] text-neutral-400 mt-1">
                  The Regional Admin will manage police officers and access records only within this region.
                </p>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-700 mb-1">
                  Initial Password
                </label>
                <div className="relative">
                  <input
                    type={showRadmPassword ? 'text' : 'password'}
                    value={radmPassword}
                    onChange={(e) => setRadmPassword(e.target.value)}
                    placeholder="SecurePass#2026"
                    className="w-full pl-3.5 pr-10 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[13px] focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRadmPassword(!showRadmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer transition-colors"
                    title={showRadmPassword ? 'Hide password' : 'View password'}
                  >
                    {showRadmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setIsAddRegionalModalOpen(false)}
                  className="px-4 py-2.5 rounded-[10px] text-[13px] font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-[10px] text-[13px] font-bold bg-[#3B5B7A] hover:bg-[#2F4962] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Provision Regional Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: ADD POLICE MEMBER                                     */}
      {/* ============================================================== */}
      {isAddOfficerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-[20px] max-w-lg w-full p-6 shadow-2xl border border-[#E5E5E5] space-y-5">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#E5E5E5] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-neutral-900">Register Police Member</h3>
                  <p className="text-[12px] text-neutral-500">
                    Onboard a police officer or detective under an authorized regional jurisdiction.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOfficerModalOpen(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddPoliceMember} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-neutral-700 mb-1">
                  Full Name / Officer Name
                </label>
                <input
                  type="text"
                  required
                  value={offFullName}
                  onChange={(e) => setOffFullName(e.target.value)}
                  placeholder="e.g. Sub-Inspector Amit Kumar"
                  className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[13px] focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-700 mb-1">
                    Username / Officer ID
                  </label>
                  <input
                    type="text"
                    required
                    value={offUsername}
                    onChange={(e) => setOffUsername(e.target.value)}
                    placeholder="e.g. off_amit"
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[13px] focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-700 mb-1">
                    Badge Number
                  </label>
                  <input
                    type="text"
                    required
                    value={offBadge}
                    onChange={(e) => setOffBadge(e.target.value)}
                    placeholder="e.g. POL-4421"
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[13px] focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-700 mb-1">
                    Regional Scope
                  </label>
                  <select
                    value={offRegion}
                    onChange={(e) => setOffRegion(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[13px] focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
                  >
                    <option value="North Region">North Region</option>
                    <option value="South Region">South Region</option>
                    <option value="East Region">East Region</option>
                    <option value="West Region">West Region</option>
                    <option value="Central Region">Central Region</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-neutral-700 mb-1">
                    Rank / Designation
                  </label>
                  <select
                    value={offRank}
                    onChange={(e) => setOffRank(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[13px] focus:outline-none focus:ring-1 focus:ring-neutral-900 bg-white"
                  >
                    <option value="Patrol Officer">Patrol Officer</option>
                    <option value="Field Detective">Field Detective</option>
                    <option value="Sub-Inspector">Sub-Inspector</option>
                    <option value="Inspector">Inspector</option>
                    <option value="Station House Officer">Station House Officer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-neutral-700 mb-1">
                  Initial Password
                </label>
                <div className="relative">
                  <input
                    type={showOffPassword ? 'text' : 'password'}
                    value={offPassword}
                    onChange={(e) => setOffPassword(e.target.value)}
                    placeholder="SecurePass#2026"
                    className="w-full pl-3.5 pr-10 py-2.5 border border-[#E5E5E5] rounded-[10px] text-[13px] focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOffPassword(!showOffPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer transition-colors"
                    title={showOffPassword ? 'Hide password' : 'View password'}
                  >
                    {showOffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Permission Checkbox */}
              <div className="p-3.5 bg-neutral-50 rounded-xl border border-[#E5E5E5] space-y-1">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={offGrantCreateRight}
                    onChange={(e) => setOffGrantCreateRight(e.target.checked)}
                    className="w-4 h-4 rounded text-slate-900 accent-slate-900 cursor-pointer"
                  />
                  <span className="text-[12px] font-bold text-neutral-800">
                    Grant Criminal Record Creation Rights immediately
                  </span>
                </label>
                <p className="text-[11px] text-neutral-500 pl-6.5">
                  Leave unchecked to keep standard default: read-only viewing of criminal data.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setIsAddOfficerModalOpen(false)}
                  className="px-4 py-2.5 rounded-[10px] text-[13px] font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-[10px] text-[13px] font-bold bg-[#171717] hover:bg-black text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Register Police Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
