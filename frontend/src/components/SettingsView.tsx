import React, { useState, useEffect } from 'react';
import { Officer, PermissionGrantItem, ActivityItem } from '../types';
import { api } from '../api';
import {
  Shield,
  Key,
  Database,
  Lock,
  HardDrive,
  RefreshCw,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  UserPlus,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building,
  MapPin,
  BadgeCheck,
  FileText
} from 'lucide-react';

interface SettingsViewProps {
  officer: Officer;
  isOffline: boolean;
  onToggleOffline: () => void;
  onResetDatabase: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  officer,
  isOffline,
  onToggleOffline,
  onResetDatabase,
}) => {
  const isSuperAdmin = Boolean(
    officer.isSuperuser ||
    officer.role === 'Super Administrator' ||
    officer.role === 'Super Admin'
  );

  const isRegionalAdmin = Boolean(
    officer.role === 'Regional Administrator' ||
    officer.role === 'Regional Admin'
  );

  const [activeTab, setActiveTab] = useState<'general' | 'superadmin' | 'regionaladmin' | 'audit'>(
    isSuperAdmin ? 'superadmin' : isRegionalAdmin ? 'regionaladmin' : 'general'
  );

  const [biometricThreshold, setBiometricThreshold] = useState('85');
  const [enableAuditLog, setEnableAuditLog] = useState(true);

  // Users & Permissions State
  const [users, setUsers] = useState<Officer[]>([]);
  const [permissionGrants, setPermissionGrants] = useState<PermissionGrantItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Regional Admin Form (Super Admin Only)
  const [newRegUsername, setNewRegUsername] = useState('');
  const [newRegPassword, setNewRegPassword] = useState('');
  const [newRegFullName, setNewRegFullName] = useState('');
  const [newRegBadge, setNewRegBadge] = useState('');
  const [newRegRegion, setNewRegRegion] = useState('North Region');

  // New Police Member Form (Regional Admin Only)
  const [newOffUsername, setNewOffUsername] = useState('');
  const [newOffPassword, setNewOffPassword] = useState('');
  const [newOffFullName, setNewOffFullName] = useState('');
  const [newOffBadge, setNewOffBadge] = useState('');
  const [newOffRank, setNewOffRank] = useState('Patrol Officer');

  // Password visibility toggles
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showOffPassword, setShowOffPassword] = useState(false);

  // Permission reason
  const [grantReason, setGrantReason] = useState('Super Admin Operational Authorization');

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [fetchedUsers, fetchedGrants, fetchedLogs] = await Promise.all([
        api.getOfficers(),
        isSuperAdmin ? api.getCriminalPermissionGrants() : Promise.resolve([]),
        isSuperAdmin ? api.getAuditLogs() : Promise.resolve([])
      ]);
      setUsers(fetchedUsers);
      setPermissionGrants(fetchedGrants);
      setAuditLogs(fetchedLogs);
    } catch (err: any) {
      console.warn('Failed to load administrative data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin || isRegionalAdmin) {
      loadAdminData();
    }
  }, [isSuperAdmin, isRegionalAdmin]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const handleCreateRegionalAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({
        username: newRegUsername.trim(),
        password: newRegPassword || 'SecurePass#2026',
        fullName: newRegFullName.trim(),
        badgeNumber: newRegBadge.trim(),
        roleName: 'Regional Administrator',
        region: newRegRegion,
        rank: 'Regional Commissioner',
        department: 'Regional Command',
        clearanceLevel: 'Level 4 - Secret'
      });
      showFeedback('success', `Regional Admin ${newRegFullName} successfully created for ${newRegRegion}.`);
      setNewRegUsername('');
      setNewRegPassword('');
      setNewRegFullName('');
      setNewRegBadge('');
      loadAdminData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to create Regional Admin');
    }
  };

  const handleCreatePoliceMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({
        username: newOffUsername.trim(),
        password: newOffPassword || 'SecurePass#2026',
        fullName: newOffFullName.trim(),
        badgeNumber: newOffBadge.trim(),
        roleName: 'Officer',
        region: officer.region || 'North Region',
        rank: newOffRank,
        department: 'General Policing',
        clearanceLevel: 'Level 2 - Confidential'
      });
      showFeedback('success', `Police Member ${newOffFullName} successfully created in ${officer.region || 'your region'}.`);
      setNewOffUsername('');
      setNewOffPassword('');
      setNewOffFullName('');
      setNewOffBadge('');
      loadAdminData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to create police member');
    }
  };

  const handleToggleCriminalPermission = async (targetUserId: string, currentGranted: boolean) => {
    try {
      const nextGranted = !currentGranted;
      await api.grantCriminalRecordPermission(targetUserId, nextGranted, grantReason);
      showFeedback('success', `Criminal record creation permission ${nextGranted ? 'GRANTED' : 'REVOKED'}.`);
      loadAdminData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to update criminal creation permission');
    }
  };

  const handleToggleUserStatus = async (targetUser: Officer) => {
    try {
      const nextActive = targetUser.status !== 'On Duty';
      await api.updateUser(targetUser.id, { isActive: nextActive });
      showFeedback('success', `User account ${nextActive ? 'activated' : 'suspended'}.`);
      loadAdminData();
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to update user status');
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto w-full">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] md:text-[30px] font-bold text-neutral-900 tracking-tight">
            System &amp; Authorization Settings
          </h1>
          <p className="text-[14px] md:text-[16px] text-neutral-500 mt-1">
            Hierarchical role enforcement, regional jurisdiction access, and criminal data creation authorization.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-xl self-start md:self-center">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
              activeTab === 'general'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            General Settings
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('superadmin')}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                activeTab === 'superadmin'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Super Admin Controls
            </button>
          )}

          {(isRegionalAdmin || isSuperAdmin) && (
            <button
              onClick={() => setActiveTab('regionaladmin')}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                activeTab === 'regionaladmin'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Regional Member Management
            </button>
          )}

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              Audit Trail
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-[13px] font-semibold ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedbackMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: SUPER ADMIN CONTROLS                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'superadmin' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Regional Admin Form */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4 lg:col-span-1">
              <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
                <UserPlus className="w-5 h-5 text-slate-800" />
                <h3 className="text-[16px] font-bold text-neutral-900">Provision Regional Admin</h3>
              </div>
              <p className="text-[12px] text-neutral-500">
                Only Super Administrators can create and assign Regional Administrators to authorized jurisdictions.
              </p>

              <form onSubmit={handleCreateRegionalAdmin} className="space-y-3">
                <div>
                  <label className="text-[12px] font-semibold text-neutral-700">Username</label>
                  <input
                    type="text"
                    required
                    value={newRegUsername}
                    onChange={(e) => setNewRegUsername(e.target.value)}
                    placeholder="e.g. reg_admin_west"
                    className="w-full mt-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-neutral-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newRegFullName}
                    onChange={(e) => setNewRegFullName(e.target.value)}
                    placeholder="e.g. Commissioner R. Sharma"
                    className="w-full mt-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-neutral-700">Badge Number</label>
                  <input
                    type="text"
                    required
                    value={newRegBadge}
                    onChange={(e) => setNewRegBadge(e.target.value)}
                    placeholder="e.g. RADM-9001"
                    className="w-full mt-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-neutral-700">Jurisdiction Region</label>
                  <select
                    value={newRegRegion}
                    onChange={(e) => setNewRegRegion(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                  >
                    <option value="North Region">North Region</option>
                    <option value="South Region">South Region</option>
                    <option value="East Region">East Region</option>
                    <option value="West Region">West Region</option>
                    <option value="Central Region">Central Region</option>
                  </select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-neutral-700">Initial Password</label>
                  <div className="relative mt-1">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={newRegPassword}
                      onChange={(e) => setNewRegPassword(e.target.value)}
                      placeholder="Default: SecurePass#2026"
                      className="w-full pl-3 pr-10 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer transition-colors"
                      title={showRegPassword ? 'Hide password' : 'View password'}
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#171717] hover:bg-black text-white text-[13px] font-semibold py-2.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Create Regional Admin
                </button>
              </form>
            </div>

            {/* Criminal Record Creation Permission Management */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-slate-800" />
                  <div>
                    <h3 className="text-[16px] font-bold text-neutral-900">
                      Criminal Record Creation Authorization
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Criminal-data creation permission (<span className="font-mono text-neutral-700 font-semibold">criminal_records.create</span>) is disabled by default for all accounts. Only Super Admin can grant or revoke it.
                    </p>
                  </div>
                </div>
                <button
                  onClick={loadAdminData}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors cursor-pointer"
                  title="Refresh permissions list"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-neutral-600">Audit Justification Reason</label>
                <input
                  type="text"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  placeholder="Reason for granting/revoking criminal creation rights"
                  className="w-full px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Officers Table */}
              <div className="overflow-x-auto border border-[#E5E7EB] rounded-xl max-h-[420px] overflow-y-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-[#E5E7EB] sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5">Officer / Personnel</th>
                      <th className="px-3 py-2.5">Role</th>
                      <th className="px-3 py-2.5">Region</th>
                      <th className="px-3 py-2.5">Create Permission</th>
                      <th className="px-3 py-2.5 text-right">Super Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {users.map((u) => {
                      const canCreate = Boolean(u.canCreateCriminals);
                      const isSuper = Boolean(u.isSuperuser || u.role === 'Super Administrator' || u.role === 'Super Admin');
                      return (
                        <tr key={u.id} className="hover:bg-neutral-50/80 transition-colors">
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-neutral-900">{u.name}</div>
                            <div className="text-[11px] text-neutral-500">Badge #{u.badgeNumber}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono font-medium text-neutral-700">{u.role || 'Officer'}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-neutral-700">{u.region || 'All (Global)'}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            {canCreate ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Authorized</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-neutral-500 font-semibold bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                                <XCircle className="w-3.5 h-3.5 text-neutral-400" />
                                <span>Denied by Default</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {isSuper ? (
                              <span className="text-[11px] text-neutral-400 italic">Universal Authority</span>
                            ) : (
                              <button
                                onClick={() => handleToggleCriminalPermission(u.id, canCreate)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${
                                  canCreate
                                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                    : 'bg-slate-900 text-white hover:bg-black'
                                }`}
                              >
                                {canCreate ? 'Revoke Permission' : 'Grant Permission'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Grant History */}
              <div className="pt-2">
                <div className="flex items-center gap-1.5 text-[13px] font-bold text-neutral-900 mb-2">
                  <History className="w-4 h-4 text-slate-700" />
                  <span>Permission Grant &amp; Revocation History</span>
                </div>
                <div className="border border-[#E5E7EB] rounded-xl overflow-hidden max-h-[180px] overflow-y-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-neutral-50 text-neutral-600 border-b border-[#E5E7EB] sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Target Officer</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Modified By</th>
                        <th className="px-3 py-2">Timestamp</th>
                        <th className="px-3 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {permissionGrants.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-3 text-center text-neutral-400">
                            No explicit permission grants recorded yet.
                          </td>
                        </tr>
                      ) : (
                        permissionGrants.map((g) => (
                          <tr key={g.id} className="hover:bg-neutral-50/60">
                            <td className="px-3 py-1.5 font-semibold text-neutral-900">{g.officerName}</td>
                            <td className="px-3 py-1.5">
                              {g.isGranted ? (
                                <span className="text-emerald-700 font-semibold">Active Grant</span>
                              ) : (
                                <span className="text-rose-700 font-semibold">Revoked</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-neutral-700">
                              {g.isGranted ? g.grantedByName || 'Super Admin' : g.revokedByName || 'Super Admin'}
                            </td>
                            <td className="px-3 py-1.5 text-neutral-500">
                              {g.isGranted ? g.grantedAt?.slice(0, 19) : g.revokedAt?.slice(0, 19)}
                            </td>
                            <td className="px-3 py-1.5 text-neutral-600">{g.reason || 'N/A'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: REGIONAL ADMIN CONTROLS                                 */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'regionaladmin' && (isRegionalAdmin || isSuperAdmin) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Police Member in Authorized Region */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4 lg:col-span-1">
              <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
                <UserPlus className="w-5 h-5 text-slate-800" />
                <h3 className="text-[16px] font-bold text-neutral-900">Add Police Member</h3>
              </div>
              <p className="text-[12px] text-neutral-500">
                Create new police-member accounts strictly within your assigned administrative scope: <strong className="text-neutral-900">{officer.region || 'Assigned Region'}</strong>.
              </p>

              <form onSubmit={handleCreatePoliceMember} className="space-y-3">
                <div>
                  <label className="text-[12px] font-semibold text-neutral-700">Username</label>
                  <input
                    type="text"
                    required
                    value={newOffUsername}
                    onChange={(e) => setNewOffUsername(e.target.value)}
                    placeholder="e.g. officer_doe"
                    className="w-full mt-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-neutral-700">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newOffFullName}
                    onChange={(e) => setNewOffFullName(e.target.value)}
                    placeholder="e.g. Inspector J. Doe"
                    className="w-full mt-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-neutral-700">Badge Number</label>
                  <input
                    type="text"
                    required
                    value={newOffBadge}
                    onChange={(e) => setNewOffBadge(e.target.value)}
                    placeholder="e.g. POL-4402"
                    className="w-full mt-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-neutral-700">Rank / Designation</label>
                  <select
                    value={newOffRank}
                    onChange={(e) => setNewOffRank(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                  >
                    <option value="Patrol Officer">Patrol Officer</option>
                    <option value="Senior Detective">Senior Detective</option>
                    <option value="Police Sub-Inspector">Police Sub-Inspector</option>
                    <option value="Station House Officer">Station House Officer</option>
                  </select>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-neutral-700">Jurisdiction Region (Locked)</label>
                  <div className="w-full mt-1 px-3 py-2 bg-neutral-100 border border-[#E5E7EB] rounded-lg text-[13px] text-neutral-700 font-semibold">
                    {officer.region || 'North Region'}
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-neutral-700">Initial Password</label>
                  <div className="relative mt-1">
                    <input
                      type={showOffPassword ? 'text' : 'password'}
                      value={newOffPassword}
                      onChange={(e) => setNewOffPassword(e.target.value)}
                      placeholder="Default: SecurePass#2026"
                      className="w-full pl-3 pr-10 py-2 border border-[#E5E7EB] rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOffPassword(!showOffPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer transition-colors"
                      title={showOffPassword ? 'Hide password' : 'View password'}
                    >
                      {showOffPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#171717] hover:bg-black text-white text-[13px] font-semibold py-2.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Create Police Member
                </button>
              </form>
            </div>

            {/* Regional User List & Status Controls */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div>
                  <h3 className="text-[16px] font-bold text-neutral-900">
                    Regional Personnel Scope: {officer.region || 'Assigned Region'}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Manage active police officers within your assigned jurisdiction. Regional Admins cannot promote officers to admin roles.
                  </p>
                </div>
                <button
                  onClick={loadAdminData}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors cursor-pointer"
                  title="Refresh personnel list"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="overflow-x-auto border border-[#E5E7EB] rounded-xl max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-[#E5E7EB] sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5">Personnel Name</th>
                      <th className="px-3 py-2.5">Badge &amp; Rank</th>
                      <th className="px-3 py-2.5">Region</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {users
                      .filter((u) => isSuperAdmin || !u.region || u.region === officer.region)
                      .map((u) => {
                        const isOnDuty = u.status === 'On Duty';
                        const isProtected = Boolean(u.isSuperuser || u.role === 'Super Administrator' || u.role === 'Regional Administrator');
                        return (
                          <tr key={u.id} className="hover:bg-neutral-50/80 transition-colors">
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-neutral-900">{u.name}</div>
                              <div className="text-[11px] text-neutral-500">{u.department}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="text-neutral-800">{u.rank}</div>
                              <div className="text-[11px] font-mono text-neutral-500">#{u.badgeNumber}</div>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-neutral-700">{u.region || 'Global'}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              {isOnDuty ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Active</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Suspended</span>
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {isProtected && !isSuperAdmin ? (
                                <span className="text-[11px] text-neutral-400 italic">Protected Scope</span>
                              ) : (
                                <button
                                  onClick={() => handleToggleUserStatus(u)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer shadow-xs ${
                                    isOnDuty
                                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                  }`}
                                >
                                  {isOnDuty ? 'Suspend Account' : 'Activate Account'}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: AUDIT TRAIL (SUPER ADMIN ONLY)                          */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'audit' && isSuperAdmin && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-800" />
              <div>
                <h3 className="text-[16px] font-bold text-neutral-900">Administrative Security Audit Trail</h3>
                <p className="text-[11px] text-neutral-500">
                  Comprehensive audit logs capturing permissions, regional promotions, dossier actions, and denied unauthorized attempts.
                </p>
              </div>
            </div>
            <button
              onClick={loadAdminData}
              className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors cursor-pointer"
              title="Refresh audit logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="overflow-x-auto border border-[#E5E7EB] rounded-xl max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-neutral-50 text-neutral-600 font-semibold border-b border-[#E5E7EB] sticky top-0">
                <tr>
                  <th className="px-3 py-2.5">Action</th>
                  <th className="px-3 py-2.5">Subject / Resource</th>
                  <th className="px-3 py-2.5">Officer / Actor</th>
                  <th className="px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-neutral-400">
                      No security audit logs retrieved.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50/60">
                      <td className="px-3 py-2 font-mono text-[11px] font-semibold text-neutral-800">
                        {log.action}
                      </td>
                      <td className="px-3 py-2 font-semibold text-neutral-900">{log.subjectName}</td>
                      <td className="px-3 py-2 text-neutral-600">{log.subjectId || 'System'}</td>
                      <td className="px-3 py-2 text-neutral-500">{log.time || log.timestamp || 'Recent'}</td>
                      <td className="px-3 py-2">
                        {log.action.includes('UNAUTHORIZED') || log.badgeType === 'error' ? (
                          <span className="text-rose-700 font-semibold bg-rose-50 px-2 py-0.5 rounded text-[10px] border border-rose-200">
                            BLOCKED
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200">
                            SUCCESS
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 4: GENERAL SYSTEM SETTINGS                                 */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Officer Credentials */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
              <Shield className="w-5 h-5 text-slate-800" />
              <h3 className="text-[16px] font-bold text-neutral-900">Officer Authentication Profile</h3>
            </div>
            <div className="flex items-center gap-4">
              <img
                src={officer.avatarUrl}
                alt={officer.name}
                className="w-14 h-14 rounded-full object-cover border border-[#E5E7EB]"
              />
              <div>
                <div className="text-[16px] font-bold text-neutral-900">{officer.name}</div>
                <div className="text-[12px] text-neutral-500">
                  Badge #{officer.badgeNumber} • {officer.rank}
                </div>
                <div className="text-[11px] font-mono text-neutral-800 font-semibold mt-0.5">
                  Clearance: {officer.clearanceLevel}
                </div>
              </div>
            </div>
            <div className="p-3.5 bg-neutral-50 rounded-xl border border-[#E5E7EB] text-[12px] text-neutral-700 space-y-1">
              <div>Department: <strong className="text-neutral-900">{officer.department}</strong></div>
              <div>Assigned Jurisdiction: <strong className="text-neutral-900">{officer.region || 'Global / Statewide'}</strong></div>
              <div>
                Criminal Creation Rights:{' '}
                <strong className={officer.canCreateCriminals ? 'text-emerald-700' : 'text-neutral-600'}>
                  {officer.canCreateCriminals ? 'Granted (Authorized)' : 'Denied (Read-Only Search)'}
                </strong>
              </div>
            </div>
          </div>

          {/* Offline Cache & Node Sync */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
              <HardDrive className="w-5 h-5 text-slate-800" />
              <h3 className="text-[16px] font-bold text-neutral-900">Offline Synchronization &amp; Storage</h3>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-[13px] font-semibold text-neutral-900">Simulate Offline Mode</div>
                <div className="text-[11px] text-neutral-500">
                  Test offline cache behavior &amp; local record persistence.
                </div>
              </div>
              <button
                onClick={onToggleOffline}
                className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold border cursor-pointer shadow-xs transition-colors ${
                  isOffline
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-neutral-800 border-[#E5E7EB] hover:bg-neutral-50'
                }`}
              >
                {isOffline ? 'Offline Active' : 'Go Offline'}
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-3">
              <div>
                <div className="text-[13px] font-semibold text-neutral-900">Reset Local Database</div>
                <div className="text-[11px] text-neutral-500">
                  Restore initial demonstration dataset records.
                </div>
              </div>
              <button
                onClick={onResetDatabase}
                className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-white hover:bg-neutral-50 border border-[#E5E7EB] text-neutral-800 flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Biometrics Engine Settings */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
              <Eye className="w-5 h-5 text-slate-800" />
              <h3 className="text-[16px] font-bold text-neutral-900">Biometric Recognition Parameters</h3>
            </div>

            <div>
              <div className="flex justify-between text-[13px] font-semibold text-neutral-900 mb-1.5">
                <span>Minimum Matching Confidence Threshold</span>
                <span className="font-mono text-neutral-900 font-bold">{biometricThreshold}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="99"
                value={biometricThreshold}
                onChange={(e) => setBiometricThreshold(e.target.value)}
                className="w-full accent-slate-900 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 mt-1 font-mono">
                <span>50% (Permissive)</span>
                <span>99% (Strict Statutory Threshold)</span>
              </div>
            </div>
          </div>

          {/* Security Policies */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3">
              <Lock className="w-5 h-5 text-slate-800" />
              <h3 className="text-[16px] font-bold text-neutral-900">Security Compliance</h3>
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-[13px] font-semibold text-neutral-900">Audit Logging</div>
                <div className="text-[11px] text-neutral-500">
                  Record all dossier views &amp; biometric inquiries to central audit trail.
                </div>
              </div>
              <input
                type="checkbox"
                checked={enableAuditLog}
                onChange={(e) => setEnableAuditLog(e.target.checked)}
                className="w-4 h-4 rounded border-[#E5E7EB] text-slate-900 focus:ring-slate-900 cursor-pointer accent-slate-900"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
