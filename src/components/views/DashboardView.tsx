import { useState } from 'react';
import { Users, Pill, ShieldAlert, FileText, RefreshCw, TrendingUp, Database, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/dashboard/StatCard';
import SectionCard from '@/components/dashboard/SectionCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import WorklistSummary from '@/components/dashboard/WorklistSummary';
import DataManagementModal from '@/components/modals/DataManagementModal';
import { ViewType } from '@/lib/types';
import { loadDB, getActiveResidents, getActiveABT, getActiveIPCases, getRecentNotes } from '@/lib/database';

interface DashboardViewProps {
  onNavigate: (view: ViewType) => void;
}

const DashboardView = ({ onNavigate }: DashboardViewProps) => {
  const [db, setDb] = useState(() => loadDB());
  const [showDataModal, setShowDataModal] = useState(false);
  
  const activeResidents = getActiveResidents(db).length;
  const activeABT = getActiveABT(db).length;
  const activeIP = getActiveIPCases(db).length;
  const pendingNotes = getRecentNotes(db, 3).length;

  const handleRefresh = () => {
    setDb(loadDB());
  };

  const handleDataChange = () => {
    setDb(loadDB());
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard Overview</h2>
          <p className="text-sm text-muted-foreground">Monitor infection control metrics at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowDataModal(true)}>
            <Database className="w-4 h-4 mr-2" />
            Data
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm">
            <TrendingUp className="w-4 h-4 mr-2" />
            Quick Stats
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          iconVariant="blue"
          value={activeResidents}
          label="Active Residents"
          change={{ value: '—', positive: true }}
          onClick={() => onNavigate('census')}
        />
        <StatCard
          icon={<Pill className="w-5 h-5" />}
          iconVariant="red"
          value={activeABT}
          label="Active ABT"
          change={{ value: '—', positive: false }}
          onClick={() => onNavigate('abt')}
        />
        <StatCard
          icon={<ShieldAlert className="w-5 h-5" />}
          iconVariant="amber"
          value={activeIP}
          label="IP Cases"
          change={{ value: '—', positive: true }}
          onClick={() => onNavigate('ip')}
        />
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          iconVariant="green"
          value={pendingNotes}
          label="Pending Notes"
          change={{ value: '—', positive: true }}
          onClick={() => onNavigate('notes')}
        />
      </div>

      {/* Worklist Summary */}
      <SectionCard title="Worklist Summary">
        <WorklistSummary onNavigateVax={() => onNavigate('vax')} />
      </SectionCard>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <SectionCard title="Recent Activity">
            <RecentActivity />
          </SectionCard>
        </div>

        {/* Quick Actions */}
        <SectionCard title="Quick Actions">
          <div className="space-y-3">
            <Button 
              variant="default" 
              className="w-full justify-start"
              onClick={() => onNavigate('resident_overview')}
            >
              <UserCheck className="w-4 h-4 mr-2" />
              Resident Overview
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => onNavigate('abt')}
            >
              <Pill className="w-4 h-4 mr-2" />
              Manage ABT
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => onNavigate('ip')}
            >
              <ShieldAlert className="w-4 h-4 mr-2" />
              Add IP Case
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => onNavigate('reports')}
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              Generate Report
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => onNavigate('census')}
            >
              <Users className="w-4 h-4 mr-2" />
              View Census
            </Button>
          </div>
        </SectionCard>
      </div>

      <DataManagementModal 
        open={showDataModal}
        onClose={() => setShowDataModal(false)}
        onDataChange={handleDataChange}
      />
    </div>
  );
};

export default DashboardView;
