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
import { inferMedicationClassFromRecord } from '@/lib/medicationClass';

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
  const [activeInsight, setActiveInsight] = useState<'census' | 'abt' | 'ip'>('census');
  
  const activeResidents = getActiveResidents(db).length;
  const activeABT = getActiveABT(db).length;
  const overdueAbtReviews = db.records.abx.filter((record) => {
    if (record.status !== 'active') return false;
    const reviewDate = (record.nextReviewDate || record.next_review_date || '').trim();
    if (!reviewDate) return false;
    const parsed = new Date(reviewDate);
    if (Number.isNaN(parsed.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    return parsed < today;
  });
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
  const censusByUnit = Object.values(db.census.residentsByMrn)
    .filter((resident) => resident.active_on_census)
    .reduce((acc, resident) => {
      const unit = resident.unit || 'Unassigned';
      acc[unit] = (acc[unit] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  const maxUnitCount = Math.max(1, ...Object.values(censusByUnit));

  const abtClasses = db.records.abx
    .filter((record) => record.status === 'active')
    .reduce((acc, record) => {
      const medClass = inferMedicationClassFromRecord(record);
      acc[medClass] = (acc[medClass] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  const maxAbtClass = Math.max(1, ...Object.values(abtClasses));

  const isolationByUnit = db.records.ip_cases
    .filter((record) => record.status === 'Active')
    .reduce((acc, record) => {
      const unit = record.unit || 'Unassigned';
      if (!acc[unit]) acc[unit] = { ebp: 0, isolation: 0 };
      if (record.protocol === 'EBP') acc[unit].ebp += 1;
      if (record.protocol === 'Isolation') acc[unit].isolation += 1;
      return acc;
    }, {} as Record<string, { ebp: number; isolation: number }>);
  const maxIsolationLoad = Math.max(
    1,
    ...Object.values(isolationByUnit).map((counts) => counts.ebp + counts.isolation),
  );

  const insightOptions = [
    {
      id: 'census',
      label: 'Census',
      value: `${activeResidents}`,
      helper: `${Object.keys(censusByUnit).length || 0} active units represented.`,
      recommendation:
        activeResidents > 0
          ? 'Hover the census tile to review residents per unit and spot uneven assignments.'
          : 'Import census data to unlock unit-level census graphics.',
      onNavigate: () => onNavigate('census'),
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
      helper: `${ipPercent}% of residents under IP surveillance.`,
      recommendation:
        ipPercent > 10
          ? 'Hover IP to view EBP/Isolation heat map and prioritize high-load units.'
          : 'Isolation load is stable. Continue daily review by unit.',
      onNavigate: () => onNavigate('ip'),
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
                onMouseEnter={() => setActiveInsight(option.id)}
                aria-pressed={activeInsight === option.id}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-3">
            {insightOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onMouseEnter={() => setActiveInsight(option.id)}
                onFocus={() => setActiveInsight(option.id)}
                onClick={() => setActiveInsight(option.id)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                  activeInsight === option.id ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-background hover:bg-muted/40'
                }`}
              >
                <p className="text-sm font-semibold">{option.label}</p>
                <p className="text-xl font-bold">{option.value}</p>
                <p className="text-xs text-muted-foreground">{option.helper}</p>
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            {activeInsight === 'census' && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Residents per Unit</p>
                {Object.entries(censusByUnit).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No census records available.</p>
                ) : (
                  Object.entries(censusByUnit).sort(([a], [b]) => a.localeCompare(b)).map(([unit, count]) => (
                    <div key={unit} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>{unit}</span><span>{count}</span>
                      </div>
                      <div className="h-2 rounded bg-muted">
                        <div className="h-2 rounded bg-primary" style={{ width: `${(count / maxUnitCount) * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeInsight === 'abt' && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">ABT Medication Class Distribution</p>
                {Object.entries(abtClasses).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active ABT courses to classify.</p>
                ) : (
                  Object.entries(abtClasses).sort(([, a], [, b]) => b - a).map(([medClass, count]) => (
                    <div key={medClass} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>{medClass}</span><span>{count}</span>
                      </div>
                      <div className="h-2 rounded bg-muted">
                        <div className="h-2 rounded bg-destructive" style={{ width: `${(count / maxAbtClass) * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {activeInsight === 'ip' && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Isolation / EBP Heat Map</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(isolationByUnit).length === 0 ? (
                    <p className="text-sm text-muted-foreground col-span-full">No active IP cases to map.</p>
                  ) : (
                    Object.entries(isolationByUnit).sort(([a], [b]) => a.localeCompare(b)).map(([unit, counts]) => {
                      const total = counts.ebp + counts.isolation;
                      const opacity = 0.2 + (total / maxIsolationLoad) * 0.7;
                      return (
                        <div key={unit} className="rounded border border-border p-3" style={{ backgroundColor: `rgba(251, 146, 60, ${opacity})` }}>
                          <p className="text-xs font-semibold">{unit}</p>
                          <p className="text-xs">Isolation: {counts.isolation}</p>
                          <p className="text-xs">EBP: {counts.ebp}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
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

      <SectionCard title="Quick Actions · Start-of-Shift Workflow">
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

      {overdueAbtReviews.length > 0 && (
        <Alert className="border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue ABT reviews: {overdueAbtReviews.length}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {overdueAbtReviews.length} active antibiotic case{overdueAbtReviews.length === 1 ? '' : 's'} are past next review date.
            </span>
            <Button size="sm" variant="outline" onClick={() => onNavigate('abt', { abtStatus: 'active' })}>
              Review ABT Worklist
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
