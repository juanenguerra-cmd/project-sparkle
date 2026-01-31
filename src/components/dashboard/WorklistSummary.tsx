import { loadDB, getActiveABT, getActiveIPCases, getVaxDue, getRecentNotes } from '@/lib/database';
import { getReofferCandidates } from '@/lib/vaccineReofferLogic';
import { RotateCcw } from 'lucide-react';

interface WorklistSummaryProps {
  onNavigateVax?: () => void;
}

const WorklistSummary = ({ onNavigateVax }: WorklistSummaryProps) => {
  const db = loadDB();
  
  // Real counts from the database - these helpers now exclude discharged residents
  const abtCount = getActiveABT(db).length;
  const ipCount = getActiveIPCases(db).length;
  const vaxDueCount = getVaxDue(db).length;
  const recentNotesCount = getRecentNotes(db, 7).length;
  
  // Get re-offer count with outbreak integration
  const activeCensusMrns = new Set(
    Object.values(db.census.residentsByMrn)
      .filter(r => r.active_on_census)
      .map(r => r.mrn)
  );
  const activeOutbreaks = db.records.outbreaks.filter(o => o.status === 'active');
  const reofferCount = getReofferCandidates(db.records.vax, activeCensusMrns, activeOutbreaks).length;

  const stats = [
    { label: 'ABT to Review', value: abtCount, bgClass: 'bg-destructive/10', textClass: 'text-destructive' },
    { label: 'IP Actions', value: ipCount, bgClass: 'bg-warning/10', textClass: 'text-warning' },
    { label: 'VAX Due', value: vaxDueCount, bgClass: 'bg-primary/10', textClass: 'text-primary' },
    { label: 'Recent Notes', value: recentNotesCount, bgClass: 'bg-success/10', textClass: 'text-success' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className={`text-center p-4 rounded-lg ${stat.bgClass}`}>
            <div className={`text-2xl font-bold ${stat.textClass}`}>{stat.value}</div>
            <div className="text-sm text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
      
      {/* Re-offer Widget */}
      {reofferCount > 0 && (
        <div 
          className="flex items-center justify-between p-3 rounded-lg bg-warning/10 border border-warning/30 cursor-pointer hover:bg-warning/20 transition-colors"
          onClick={onNavigateVax}
        >
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-warning" />
            <span className="text-sm font-medium">
              {reofferCount} vaccine{reofferCount !== 1 ? 's' : ''} due for re-offer
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Click to view →</span>
        </div>
      )}
    </div>
  );
};

export default WorklistSummary;
