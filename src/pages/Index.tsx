import { useState, useCallback, useEffect } from 'react';
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
import DataManagementModal from '@/components/modals/DataManagementModal';
import BackupReminderBanner from '@/components/BackupReminderBanner';
import LockScreen from '@/components/LockScreen';
import { Toaster } from '@/components/ui/toaster';
import { useDataLoader } from '@/hooks/useDataLoader';

const Index = () => {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [surveyorMode, setSurveyorMode] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDataChange = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  // Auto-load initial data if database is empty
  const { loading: dataLoading } = useDataLoader(handleDataChange);

  const handleAddResident = () => {
    setActiveView('census');
  };

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView onNavigate={setActiveView} />;
      case 'abt':
        return <ABTView />;
      case 'census':
        return <CensusView />;
      case 'resident_overview':
        return <ResidentOverviewView />;
      case 'ip':
        return <IPView />;
      case 'vax':
        return <VAXView />;
      case 'notes':
        return <NotesView />;
      case 'outbreak':
        return <OutbreakView />;
      case 'reports':
        return <ReportsView surveyorMode={surveyorMode} />;
      case 'audit':
        return <AuditView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={setActiveView} />;
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
      <div className="min-h-screen bg-background">
        <BackupReminderBanner onDataChange={handleDataChange} />
        <AppHeader 
          surveyorMode={surveyorMode}
          onToggleSurveyorMode={() => setSurveyorMode(!surveyorMode)}
          onAddResident={handleAddResident}
          onOpenDataModal={() => setShowDataModal(true)}
        />
        
        <div className="flex">
          <Sidebar 
            activeView={activeView} 
            onViewChange={setActiveView} 
          />
          
          <main className="flex-1 p-4 md:p-6 pb-20 lg:pb-6 overflow-auto min-h-[calc(100vh-80px)]">
            <div key={refreshKey} className="max-w-7xl mx-auto">
              {renderView()}
            </div>
          </main>
        </div>

        <MobileNav 
          activeView={activeView} 
          onViewChange={setActiveView} 
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
