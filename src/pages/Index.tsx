import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ViewType } from '@/lib/types';
import AppHeader from '@/components/layout/AppHeader';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import DashboardView from '@/components/views/DashboardView';
import ABTView from '@/components/views/ABTView';
import CensusView from '@/components/views/CensusView';
import ResidentOverviewView from '@/components/views/ResidentOverviewView';
import IPView from '@/components/views/IPView';
import VAXView from '@/components/views/VAXView';
import NotesView from '@/components/views/NotesView';
import OutbreakView from '@/components/views/OutbreakView';
import ReportsView from '@/components/views/ReportsView';
import AuditView from '@/components/views/AuditView';
import SettingsView from '@/components/views/SettingsView';
import ReferenceLibraryView from '@/components/views/ReferenceLibraryView';
import DataManagementModal from '@/components/modals/DataManagementModal';
import BackupReminderBanner from '@/components/BackupReminderBanner';
import LockScreen from '@/components/LockScreen';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { useDataLoader } from '@/hooks/useDataLoader';

interface ViewFilters {
  ipStatus?: 'active' | 'resolved';
  abtStatus?: 'active' | 'completed' | 'all';
  vaxStatus?: 'due' | 'overdue' | 'due_or_overdue' | 'all';
}

const Index = () => {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [surveyorMode, setSurveyorMode] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLoadError, setShowLoadError] = useState(false);
  const [viewFilters, setViewFilters] = useState<ViewFilters>({});

  const handleDataChange = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Auto-load initial data if database is empty
  const { loading: dataLoading, error: dataLoadError } = useDataLoader(handleDataChange);

  useEffect(() => {
    if (dataLoadError) {
      setShowLoadError(true);
    }
  }, [dataLoadError]);

  const handleRetryDataLoad = () => {
    localStorage.removeItem('icn_hub_initial_load_attempted');
    window.location.reload();
  };

  const handleAddResident = () => {
    setActiveView('census');
  };

  const handleNavigate = useCallback((view: ViewType, filters?: ViewFilters) => {
    setActiveView(view);
    setViewFilters(filters ?? {});
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView onNavigate={handleNavigate} />;
      case 'abt':
        return <ABTView onNavigate={handleNavigate} initialStatusFilter={viewFilters.abtStatus} />;
      case 'census':
        return <CensusView onNavigate={setActiveView} />;
      case 'resident_overview':
        return <ResidentOverviewView />;
      case 'ip':
        return <IPView onNavigate={handleNavigate} initialStatusFilter={viewFilters.ipStatus} />;
      case 'vax':
        return <VAXView initialStatusFilter={viewFilters.vaxStatus} />;
      case 'notes':
        return <NotesView onNavigate={setActiveView} />;
      case 'outbreak':
        return <OutbreakView onNavigate={setActiveView} />;
      case 'reports':
        return <ReportsView surveyorMode={surveyorMode} onNavigate={setActiveView} />;
      case 'reference_library':
        return <ReferenceLibraryView />;
      case 'audit':
        return <AuditView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={handleNavigate} />;
    }
  };

  // Show loading indicator while initial data loads
  if (dataLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <LockScreen>
      <div className="flex h-[100dvh] flex-col bg-background overflow-hidden">
        <BackupReminderBanner onDataChange={handleDataChange} />
        {dataLoadError && showLoadError && (
          <div className="px-4 pt-4 md:px-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Initial data load failed</AlertTitle>
              <AlertDescription>
                <p className="text-sm text-destructive-foreground/90">
                  {dataLoadError}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleRetryDataLoad}>
                    Retry load
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowLoadError(false)}>
                    Dismiss
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
        <AppHeader 
          surveyorMode={surveyorMode}
          onToggleSurveyorMode={() => setSurveyorMode(!surveyorMode)}
          onAddResident={handleAddResident}
          onOpenDataModal={() => setShowDataModal(true)}
        />
        
        <div className="flex flex-1 overflow-hidden">
          <Sidebar 
            activeView={activeView} 
            onViewChange={(view) => handleNavigate(view)} 
          />
          
          <main className="flex-1 p-4 md:p-6 pb-20 lg:pb-6 overflow-auto">
            <div key={refreshKey} className="max-w-7xl mx-auto">
              {renderView()}
            </div>
          </main>
        </div>

        <MobileNav 
          activeView={activeView} 
          onViewChange={(view) => handleNavigate(view)} 
        />
        
        <DataManagementModal
          open={showDataModal}
          onClose={() => setShowDataModal(false)}
          onDataChange={handleDataChange}
        />
        
        <Toaster />
      </div>
    </LockScreen>
  );
};

export default Index;
