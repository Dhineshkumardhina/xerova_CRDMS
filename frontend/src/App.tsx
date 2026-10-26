import React, { useState, useEffect } from 'react';
import {
  ActiveTab,
  CriminalProfile,
  CaseRecord,
  CaseStatus,
  MediaItem,
  DocumentItem,
  CrimeCategoryType,
  Officer,
  ActivityItem,
} from './types';
import {
  INITIAL_PROFILES,
  CATEGORY_STATS,
  INITIAL_ACTIVITY,
  CURRENT_OFFICER,
} from './constants/mockData';
import { api } from './api';

// Component Imports
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { MobileNavBar } from './components/MobileNavBar';
import { DashboardView } from './components/DashboardView';
import { SearchResultsView } from './components/SearchResultsView';
import { CriminalProfileView } from './components/CriminalProfileView';
import { CategoriesView } from './components/CategoriesView';
import { CasesListView } from './components/CasesListView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { SupportLexiconView } from './components/SupportLexiconView';
import { OfflineScreen } from './components/OfflineScreen';
import { PhotoSearchModal } from './components/PhotoSearchModal';
import { NewRecordModal } from './components/NewRecordModal';
import { CaseDetailsModal } from './components/CaseDetailsModal';
import { MediaZoomModal } from './components/MediaZoomModal';

const STORAGE_KEY = 'crms_criminal_profiles_v2';

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('crms_access_token'));
  });
  const [officer, setOfficer] = useState<Officer>(CURRENT_OFFICER);
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  // Network / Offline State
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [showOfflineScreen, setShowOfflineScreen] = useState<boolean>(false);

  // Navigation State
  const [currentTab, setCurrentTab] = useState<ActiveTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  // Data State
  const [profiles, setProfiles] = useState<CriminalProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load cached profiles:', e);
    }
    return INITIAL_PROFILES;
  });

  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITY);
  const [selectedProfile, setSelectedProfile] = useState<CriminalProfile | null>(() => profiles[0] || null);

  // Dynamic category calculations based on actual profiles
  const categories = CATEGORY_STATS.map((cat) => ({
    ...cat,
    recordsCount: profiles.filter((p) => p.category === cat.category).length,
  }));

  // Modals State
  const [isPhotoSearchOpen, setIsPhotoSearchOpen] = useState<boolean>(false);
  const [photoSearchInitialMode, setPhotoSearchInitialMode] = useState<'presets' | 'camera' | 'upload'>('camera');
  const [isNewRecordOpen, setIsNewRecordOpen] = useState<boolean>(false);
  const [editingProfile, setEditingProfile] = useState<CriminalProfile | null>(null);
  const [activeCaseModal, setActiveCaseModal] = useState<CaseRecord | null>(null);
  const [activeMediaModal, setActiveMediaModal] = useState<MediaItem | null>(null);
  const [activeDocModal, setActiveDocModal] = useState<DocumentItem | null>(null);

  // Initial Auth Verification & Session Restoration
  useEffect(() => {
    const token = localStorage.getItem('crms_access_token');
    if (token) {
      api.getMe()
        .then((user) => {
          setOfficer(user);
          setIsAuthenticated(true);
        })
        .catch(() => {
          setIsAuthenticated(false);
        })
        .finally(() => {
          setIsCheckingAuth(false);
        });
    } else {
      setIsAuthenticated(false);
      setIsCheckingAuth(false);
    }

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
    };

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('crms:unauthorized', handleUnauthorized);

    if (!navigator.onLine) {
      setIsOffline(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('crms:unauthorized', handleUnauthorized);
    };
  }, []);

  // Sync from backend when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      api.getProfiles().then((data) => {
        if (data && data.length > 0) {
          setProfiles(data);
          if (!selectedProfile) setSelectedProfile(data[0]);
        }
      });
      api.getAuditLogs().then((logs) => {
        if (logs && logs.length > 0) {
          setActivities(logs);
        }
      });
    }
  }, [isAuthenticated]);

  // Sync to local storage as fallback cache
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch (e) {
      console.warn('Failed to persist profiles:', e);
    }
  }, [profiles]);

  // Listen to browser network changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowOfflineScreen(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setShowOfflineScreen(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handlers
  const handleLogin = async (officerId: string, password?: string) => {
    const res = await api.login(officerId, password);
    setOfficer(res.officer);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
  };

  const handleToggleOffline = () => {
    if (!isOffline) {
      setIsOffline(true);
      setShowOfflineScreen(true);
    } else {
      setIsOffline(false);
      setShowOfflineScreen(false);
    }
  };

  const handleSelectTab = (tab: ActiveTab) => {
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (query: string) => {
    setSearchQuery(query);
    setCurrentTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCategory = (cat: CrimeCategoryType) => {
    setSelectedCategoryFilter(cat);
    setCurrentTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectProfile = (profile: CriminalProfile) => {
    setSelectedProfile(profile);
    setCurrentTab('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveProfile = (saved: CriminalProfile) => {
    api.saveProfile(saved);
    setProfiles((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? saved : p));
      } else {
        return [saved, ...prev];
      }
    });

    // Add activity log
    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      subjectName: saved.name,
      subjectId: saved.id,
      action: editingProfile ? 'Status Updated' : 'Warrant Issued',
      time: 'Just now',
      mugshotUrl: saved.mugshotUrl,
      profileId: saved.id,
    };
    setActivities((prev) => [newActivity, ...prev]);

    setSelectedProfile(saved);
    setCurrentTab('profile');
  };

  const handleArchiveToggle = (profileId: string) => {
    api.toggleArchive(profileId);
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id === profileId) {
          const updated = { ...p, isArchived: !p.isArchived };
          if (selectedProfile?.id === profileId) {
            setSelectedProfile(updated);
          }
          return updated;
        }
        return p;
      })
    );
  };

  const handleUploadMedia = (profileId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      const newMedia: MediaItem = {
        id: `m-${Date.now()}`,
        url,
        title: file.name,
        type: 'photo',
        dateUploaded: 'Today',
        filename: file.name,
      };

      setProfiles((prev) =>
        prev.map((p) => {
          if (p.id === profileId) {
            const updated = { ...p, media: [...p.media, newMedia] };
            if (selectedProfile?.id === profileId) {
              setSelectedProfile(updated);
            }
            return updated;
          }
          return p;
        })
      );
    };
    reader.readAsDataURL(file);
  };

  const handleUploadDoc = (profileId: string, title: string) => {
    const newDoc: DocumentItem = {
      id: `doc-${Date.now()}`,
      title,
      type: 'pdf',
      dateUploaded: 'Today',
      filename: title.endsWith('.pdf') ? title : `${title}.pdf`,
      size: '1.2 MB',
    };

    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id === profileId) {
          const updated = { ...p, documents: [...p.documents, newDoc] };
          if (selectedProfile?.id === profileId) {
            setSelectedProfile(updated);
          }
          return updated;
        }
        return p;
      })
    );
  };

  const handleBulkUpdateCaseStatus = (caseIds: string[], newStatus: CaseStatus) => {
    api.bulkUpdateCaseStatus(caseIds, newStatus);
    setProfiles((prev) =>
      prev.map((profile) => {
        const hasCase = profile.cases.some((c) => caseIds.includes(c.id));
        if (!hasCase) return profile;
        return {
          ...profile,
          cases: profile.cases.map((c) =>
            caseIds.includes(c.id) ? { ...c, status: newStatus } : c
          ),
        };
      })
    );

    // Add activity log
    const newActivity: ActivityItem = {
      id: `act-${Date.now()}`,
      subjectName: `${caseIds.length} Case Dossiers`,
      subjectId: 'BULK-UPDATE',
      action: newStatus === 'Closed' ? 'Case Closed' : newStatus === 'Warrant Issued' ? 'Warrant Issued' : 'Status Updated',
      time: 'Just now',
      mugshotUrl: profiles[0]?.mugshotUrl || '',
      profileId: profiles[0]?.id || '',
    };
    setActivities((prev) => [newActivity, ...prev]);
  };

  const handleResetDatabase = () => {
    localStorage.removeItem(STORAGE_KEY);
    setProfiles([]);
    setSelectedProfile(null);
    setActivities([]);
    alert('Database cleared of all criminal records and activity logs.');
  };

  if (isCheckingAuth) {
    return (
      <div className="bg-[#F5F6F8] min-h-screen flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 text-neutral-800 text-[14px]">
          <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
          <span>Verifying Security Clearance...</span>
        </div>
      </div>
    );
  }

  // If not logged in, render the login screen
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // If offline screen is triggered
  if (showOfflineScreen) {
    return (
      <OfflineScreen
        onRetry={() => {
          setIsOffline(false);
          setShowOfflineScreen(false);
        }}
        onWorkOffline={() => {
          setShowOfflineScreen(false);
        }}
      />
    );
  }

  return (
    <div className="bg-[#FAFAFA] min-h-screen flex flex-col md:flex-row text-[#0A0A0A] font-sans antialiased selection:bg-black selection:text-white">
      {/* Desktop Fixed Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        onOpenNewRecord={() => {
          setEditingProfile(null);
          setIsNewRecordOpen(true);
        }}
        onLogout={handleLogout}
        officer={officer}
        isOffline={isOffline}
        onToggleOffline={handleToggleOffline}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-[260px] min-h-screen">
        {/* PWA Offline Network Banner */}
        {isOffline && (
          <div className="bg-[#171717] text-white px-4 py-2 text-[12px] flex items-center justify-between z-50 sticky top-0 border-b border-amber-500/40 shadow-md">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span><strong>Connection unavailable:</strong> REST API server unreachable. App shell running in safe offline mode.</span>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 rounded-[6px] text-[11px] transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top Header (Desktop) */}
        <div className="hidden md:block">
          <TopHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchSubmit={handleSearchSubmit}
            onSelectProfile={handleSelectProfile}
            allProfiles={profiles}
            officer={officer}
            onLogout={handleLogout}
            isOffline={isOffline}
            onToggleOffline={handleToggleOffline}
          />
        </div>

        {/* Mobile Top Navigation */}
        <MobileNavBar
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          officer={officer}
          isSubPage={currentTab === 'profile'}
          subPageTitle={selectedProfile?.name || 'Profile'}
          onBack={() => setCurrentTab('search')}
        />

        {/* Dynamic View Canvas */}
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-12 max-w-[1440px] w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              onSearch={handleSearchSubmit}
              onSelectCategory={handleSelectCategory}
              onSelectProfile={handleSelectProfile}
              onOpenPhotoSearch={() => {
                setPhotoSearchInitialMode('camera');
                setIsPhotoSearchOpen(true);
              }}
              onViewAllRecords={() => {
                setSearchQuery('');
                setSelectedCategoryFilter(null);
                setCurrentTab('search');
              }}
              categories={categories}
              recentActivities={activities}
              allProfiles={profiles}
            />
          )}

          {(currentTab === 'search' || currentTab === 'criminals') && (
            <SearchResultsView
              initialQuery={searchQuery}
              allProfiles={profiles}
              onSelectProfile={handleSelectProfile}
              selectedCategoryFilter={selectedCategoryFilter}
              onClearCategoryFilter={() => setSelectedCategoryFilter(null)}
            />
          )}

          {currentTab === 'profile' && (
            <CriminalProfileView
              profile={selectedProfile}
              onEdit={(p) => {
                setEditingProfile(p);
                setIsNewRecordOpen(true);
              }}
              onArchiveToggle={handleArchiveToggle}
              onOpenCaseModal={(cs) => setActiveCaseModal(cs)}
              onOpenMediaModal={(m) => setActiveMediaModal(m)}
              onOpenDocModal={(d) => setActiveDocModal(d)}
              onUploadMedia={handleUploadMedia}
              onUploadDoc={handleUploadDoc}
            />
          )}

          {currentTab === 'categories' && (
            <CategoriesView
              categories={categories}
              allProfiles={profiles}
              onSelectCategory={handleSelectCategory}
              onSelectProfile={handleSelectProfile}
            />
          )}

          {currentTab === 'cases' && (
            <CasesListView
              allProfiles={profiles}
              onOpenCaseModal={(cs) => setActiveCaseModal(cs)}
              onSelectProfile={handleSelectProfile}
              onBulkUpdateStatus={handleBulkUpdateCaseStatus}
            />
          )}

          {currentTab === 'reports' && <ReportsView allProfiles={profiles} />}

          {currentTab === 'settings' && (
            <SettingsView
              officer={officer}
              isOffline={isOffline}
              onToggleOffline={handleToggleOffline}
              onResetDatabase={handleResetDatabase}
            />
          )}

          {currentTab === 'support' && <SupportLexiconView />}
        </main>
      </div>

      {/* Interactive Modals */}
      <PhotoSearchModal
        isOpen={isPhotoSearchOpen}
        onClose={() => setIsPhotoSearchOpen(false)}
        allProfiles={profiles}
        onSelectMatchedProfile={handleSelectProfile}
        initialMode={photoSearchInitialMode}
      />

      <NewRecordModal
        isOpen={isNewRecordOpen}
        onClose={() => setIsNewRecordOpen(false)}
        onSave={handleSaveProfile}
        editingProfile={editingProfile}
      />

      <CaseDetailsModal
        caseRecord={activeCaseModal}
        onClose={() => setActiveCaseModal(null)}
      />

      <MediaZoomModal
        media={activeMediaModal}
        document={activeDocModal}
        onClose={() => {
          setActiveMediaModal(null);
          setActiveDocModal(null);
        }}
      />
    </div>
  );
}
