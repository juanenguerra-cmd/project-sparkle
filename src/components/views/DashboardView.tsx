import { useState } from 'react';
import { Users, Pill, ShieldAlert, FileText, RefreshCw, TrendingUp, Database, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatCard from '@/components/dashboard/StatCard';
import SectionCard from '@/components/dashboard/SectionCard';
import RecentActivity from '@/components/dashboard/RecentActivity';
import WorklistSummary from '@/components/dashboard/WorklistSummary';
import DataManagementModal from '@/components/modals/DataManagementModal';
import { ViewType } from '@/lib/types';
import { 
  loadDB, 
  saveDB, 
  getActiveResidents, 
  getActiveABT, 
  getActiveIPCases, 
  getRecentNotes, 
  getVaxDue,
  getLineListingRecommendations, 
  dismissLineListingRecommendation 
} from '@/lib/database';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface DashboardViewProps {
  onNavigate: (
    view: ViewType,
    filters?: {
      ipStatus?: 'active' | 'resolved';
      abtStatus?: 'active' | 'completed' | 'all';
      vaxStatus?: 'due' | 'overdue' | 'due_or_overdue' | 'all';
    },
  ) => void;
}

const DashboardView = ({ onNavigate }: DashboardViewProps) => {
  const [db, setDb] = useState(() => loadDB());
  const [showDataModal, setShowDataModal] = useState(false);
  const [activeInsight, setActiveInsight] = useState<'coverage' | 'abt' | 'ip' | 'notes'>('coverage');
  
  const activeResidents = getActiveResidents(db).length;
  const activeABT = getActiveABT(db).length;
  const activeIP = getActiveIPCases(db).length;
  const pendingNotes = getRecentNotes(db, 3).length;
  const dueVaxCount = getVaxDue(db).length;
  const lineListingRecommendations = getLineListingRecommendations(db);
  const hasResidentData = activeResidents > 0;
  const hasClinicalData = activeABT > 0 || activeIP > 0 || pendingNotes > 0;
  const clinicalTouchpoints = activeABT + activeIP + pendingNotes;
  const residentDenominator = Math.max(activeResidents, 1);
  const clinicalCoveragePercent = Math.min(
    100,
    Math.round((clinicalTouchpoints / residentDenominator) * 100)
  );
  const abtPercent = Math.min(100, Math.round((activeABT / residentDenominator) * 100));
  const ipPercent = Math.min(100, Math.round((activeIP / residentDenominator) * 100));
  const notesPercent = Math.min(100, Math.round((pendingNotes / residentDenominator) * 100));

  const insightOptions = [
    {
      id: 'coverage',
      label: 'Coverage',
      value: `${clinicalCoveragePercent}%`,
      helper: `${clinicalTouchpoints} touchpoints logged today.`,
      recommendation:
        clinicalCoveragePercent >= 85
          ? 'Coverage is strong. Focus on documenting any late-day notes before shift close.'
          : 'Boost coverage by logging remaining IP rounds or pending clinical notes.',
      onNavigate: () => onNavigate('notes'),
    },
    {
      id: 'abt',
      label: 'ABT Courses',
      value: `${activeABT}`,
      helper: `${abtPercent}% of residents on antibiotics.`,
      recommendation:
        abtPercent > 15
          ? 'Review antibiotic stop dates and confirm indications for active courses.'
          : 'ABT utilization is low. Ensure prophylaxis orders are captured.',
      onNavigate: () => onNavigate('abt'),
    },
    {
      id: 'ip',
      label: 'IP Cases',
      value: `${activeIP}`,
      helper: `${ipPercent}% of residents under isolation.`,
      recommendation:
        ipPercent > 10
          ? 'Prioritize IP re-evaluations and verify PPE signage coverage.'
          : 'Isolation load is stable. Keep monitoring for symptom onset.',
      onNavigate: () => onNavigate('ip'),
    },
    {
      id: 'notes',
      label: 'Recent Notes',
      value: `${pendingNotes}`,
      helper: `${notesPercent}% of residents have new notes.`,
      recommendation:
        notesPercent > 20
          ? 'Triage new notes to flag residents needing follow-up or labs.'
          : 'Notes volume is manageable. Encourage timely end-of-shift summaries.',
      onNavigate: () => onNavigate('notes'),
    },
  ] as const;

  const activeInsightDetails = insightOptions.find((option) => option.id === activeInsight);

  const handleRefresh = () => {
    setDb(loadDB());
  };

  const handleDataChange = () => {
    setDb(loadDB());
  };

  const handleDismissRecommendation = (recommendationId: string) => {
    const nextDb = loadDB();
    dismissLineListingRecommendation(nextDb, recommendationId);
    saveDB(nextDb);
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
          label="Pending ABT"
          change={{ value: '—', positive: false }}
          onClick={() => onNavigate('abt', { abtStatus: 'active' })}
        />
        <StatCard
          icon={<ShieldAlert className="w-5 h-5" />}
          iconVariant="amber"
          value={activeIP}
          label="Active IP Cases"
          change={{ value: '—', positive: true }}
          onClick={() => onNavigate('ip', { ipStatus: 'active' })}
        />
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          iconVariant="green"
          value={dueVaxCount}
          label="Vaccination Due"
          change={{ value: '—', positive: true }}
          onClick={() => onNavigate('vax', { vaxStatus: 'due_or_overdue' })}
        />
      </div>

      {!hasResidentData && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Data readiness check</AlertTitle>
          <AlertDescription className="text-amber-900/90">
            Import your census to unlock resident-based workflows. Once the census is loaded, IP, ABT, and Notes
            will align to the active roster.
          </AlertDescription>
        </Alert>
      )}
      {hasResidentData && !hasClinicalData && (
        <Alert className="bg-blue-50 border-blue-200 text-blue-900">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertTitle>Start-of-shift setup</AlertTitle>
          <AlertDescription className="text-blue-900/90">
            Census is ready. Add initial IP cases, ABT courses, and clinical notes to activate today’s worklists.
          </AlertDescription>
        </Alert>
      )}

      <SectionCard title="Infection Control Infographic">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
          <div>
            <p className="text-sm font-medium text-foreground">Interactive focus</p>
            <p className="text-xs text-muted-foreground">Select a metric to spotlight recommendations.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {insightOptions.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={activeInsight === option.id ? 'default' : 'outline'}
                onClick={() => setActiveInsight(option.id)}
                aria-pressed={activeInsight === option.id}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div
            className={`flex flex-col items-start gap-4 rounded-lg border border-border p-5 transition ${
              activeInsight === 'coverage' ? 'bg-primary/10 shadow-sm' : 'bg-muted/30'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 via-primary/15 to-transparent text-primary shadow-inner">
                <div className="text-center">
                  <p className="text-2xl font-semibold leading-none">{activeResidents}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Residents</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Clinical Coverage</p>
                <p className="text-xs text-muted-foreground">Touchpoints logged today</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{clinicalCoveragePercent}%</p>
              </div>
            </div>
            <div className="w-full">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Coverage Goal</span>
                <span>100%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{ width: `${clinicalCoveragePercent}%` }}
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 grid gap-4 sm:grid-cols-3">
            <div
              className={`rounded-lg border border-border bg-background p-4 space-y-3 transition ${
                activeInsight === 'abt' ? 'ring-2 ring-destructive/40' : ''
              }`}
            >
              <div className="flex items-center justify-between text-sm font-medium text-foreground">
                <span>ABT Courses</span>
                <span className="text-destructive">{activeABT}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div className="h-2 rounded-full bg-destructive" style={{ width: `${abtPercent}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{abtPercent}% of residents on active antibiotics.</p>
            </div>
            <div
              className={`rounded-lg border border-border bg-background p-4 space-y-3 transition ${
                activeInsight === 'ip' ? 'ring-2 ring-warning/40' : ''
              }`}
            >
              <div className="flex items-center justify-between text-sm font-medium text-foreground">
                <span>IP Cases</span>
                <span className="text-warning">{activeIP}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div className="h-2 rounded-full bg-warning" style={{ width: `${ipPercent}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{ipPercent}% of residents under isolation.</p>
            </div>
            <div
              className={`rounded-lg border border-border bg-background p-4 space-y-3 transition ${
                activeInsight === 'notes' ? 'ring-2 ring-info/40' : ''
              }`}
            >
              <div className="flex items-center justify-between text-sm font-medium text-foreground">
                <span>Recent Notes</span>
                <span className="text-info">{pendingNotes}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted">
                <div className="h-2 rounded-full bg-info" style={{ width: `${notesPercent}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{notesPercent}% of residents with new notes.</p>
            </div>
          </div>
        </div>
        {activeInsightDetails && (
          <div className="mt-5 grid gap-4 rounded-lg border border-border bg-background p-4 sm:grid-cols-[1.5fr_auto] sm:items-center">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-foreground">{activeInsightDetails.label} Insights</span>
                <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  Current: {activeInsightDetails.value}
                </span>
                <span className="text-xs text-muted-foreground">{activeInsightDetails.helper}</span>
              </div>
              <p className="text-sm text-foreground">{activeInsightDetails.recommendation}</p>
            </div>
            <Button size="sm" variant="outline" onClick={activeInsightDetails.onNavigate}>
              Go to {activeInsightDetails.label}
            </Button>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Start-of-Shift Workflow">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-background p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              1. Verify Census
            </div>
            <p className="text-xs text-muted-foreground">Confirm active residents and units are up to date.</p>
            <Button size="sm" variant="outline" className="w-full" onClick={() => onNavigate('census')}>
              Review Census
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-background p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldAlert className="w-4 h-4 text-warning" />
              2. Update IP Cases
            </div>
            <p className="text-xs text-muted-foreground">Log new isolation precautions and reviews.</p>
            <Button size="sm" variant="outline" className="w-full" onClick={() => onNavigate('ip')}>
              Go to IP Tracker
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-background p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Pill className="w-4 h-4 text-destructive" />
              3. Review ABT
            </div>
            <p className="text-xs text-muted-foreground">Confirm antibiotic courses and stewardship notes.</p>
            <Button size="sm" variant="outline" className="w-full" onClick={() => onNavigate('abt')}>
              Review ABT
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-background p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4 text-info" />
              4. Capture Notes
            </div>
            <p className="text-xs text-muted-foreground">Document symptoms, follow-ups, and action items.</p>
            <Button size="sm" variant="outline" className="w-full" onClick={() => onNavigate('notes')}>
              Add Notes
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={() => onNavigate('reports')}>
            <TrendingUp className="w-4 h-4 mr-2" />
            Generate Daily Report
          </Button>
          <Button size="sm" variant="outline" onClick={() => onNavigate('outbreak')}>
            <AlertTriangle className="w-4 h-4 mr-2" />
            Review Outbreaks
          </Button>
        </div>
      </SectionCard>

      {/* Worklist Summary */}
      <SectionCard title="Worklist Summary">
        <WorklistSummary onNavigateVax={() => onNavigate('vax')} />
      </SectionCard>

      <SectionCard
        title={`Line Listing Recommendations${lineListingRecommendations.length ? ` (${lineListingRecommendations.length})` : ''}`}
        actions={
          lineListingRecommendations.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => onNavigate('outbreak')}>
              Review Line Listings
            </Button>
          ) : undefined
        }
      >
        {lineListingRecommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ABT-based line listing recommendations.</p>
        ) : (
          <div className="space-y-3">
            {lineListingRecommendations.slice(0, 5).map(rec => (
              <div key={rec.id} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{rec.residentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {rec.unit} • {rec.room} • {rec.infectionSource}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => onNavigate('outbreak')}>
                    Add to Line Listing
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDismissRecommendation(rec.id)}>
                    Clear
                  </Button>
                </div>
              </div>
            ))}
            {lineListingRecommendations.length > 5 && (
              <p className="text-xs text-muted-foreground">Showing first 5 recommendations.</p>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent Activity">
        <RecentActivity />
      </SectionCard>

      <DataManagementModal 
        open={showDataModal}
        onClose={() => setShowDataModal(false)}
        onDataChange={handleDataChange}
      />
    </div>
  );
};

export default DashboardView;
