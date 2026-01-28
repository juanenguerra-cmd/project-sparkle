import { loadDB, getActiveABT, getActiveIPCases, getVaxDue, getRecentNotes } from '@/lib/database';

const WorklistSummary = () => {
  const db = loadDB();
  
  // Real counts from the database - these helpers now exclude discharged residents
  const abtCount = getActiveABT(db).length;
  const ipCount = getActiveIPCases(db).length;
  const vaxDueCount = getVaxDue(db).length;
  const recentNotesCount = getRecentNotes(db, 7).length;

  const stats = [
    { label: 'ABT to Review', value: abtCount, bgClass: 'bg-destructive/10', textClass: 'text-destructive' },
    { label: 'IP Actions', value: ipCount, bgClass: 'bg-warning/10', textClass: 'text-warning' },
    { label: 'VAX Due', value: vaxDueCount, bgClass: 'bg-primary/10', textClass: 'text-primary' },
    { label: 'Recent Notes', value: recentNotesCount, bgClass: 'bg-success/10', textClass: 'text-success' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <div key={i} className={`text-center p-4 rounded-lg ${stat.bgClass}`}>
          <div className={`text-2xl font-bold ${stat.textClass}`}>{stat.value}</div>
          <div className="text-sm text-muted-foreground">{stat.label}</div>
        </div>
      ))}
    </div>
  );
};

export default WorklistSummary;
