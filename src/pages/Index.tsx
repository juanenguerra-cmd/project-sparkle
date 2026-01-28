import { useState } from 'react';
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
import LockScreen from '@/components/LockScreen';
import { Toaster } from '@/components/ui/toaster';

const Index = () => {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [surveyorMode, setSurveyorMode] = useState(false);
  const [showDataModal, setShowDataModal] = useState(false);

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
        return <ReportsView />;
      case 'audit':
        return <AuditView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={setActiveView} />;
    }
  };

  return (
    <LockScreen>
      <div className="min-h-screen bg-background">
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
            <div className="max-w-7xl mx-auto">
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
          onDataChange={() => {}}
        />
        
        <Toaster />
      </div>
    </LockScreen>
  );
};

export default Index;
