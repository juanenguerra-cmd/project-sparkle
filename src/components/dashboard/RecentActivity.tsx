import { useState } from 'react';
import { loadDB, saveDB } from '@/lib/database';
import { Clock, Trash2 } from 'lucide-react';
import { AuditEntry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const RecentActivity = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();
  
  const db = loadDB();
  
  // Filter for clinical events only (ABT, IP, VAX, Notes) - exclude administrative noise
  const clinicalEntityTypes: AuditEntry['entityType'][] = ['abt', 'ip', 'vax', 'notes', 'abx'];
  
  const activities = db.audit_log
    .filter(entry => clinicalEntityTypes.includes(entry.entityType))
    .slice(0, 5);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? '' : 's'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };

  const getActionIcon = (entityType: string) => {
    switch (entityType) {
      case 'abt':
      case 'abx': return '💊';
      case 'ip': return '🛡️';
      case 'vax': return '💉';
      case 'notes': return '📝';
      default: return '🕘';
    }
  };

  const handleClearActivity = () => {
    const db = loadDB();
    // Only clear clinical activity entries
    db.audit_log = db.audit_log.filter(
      entry => !clinicalEntityTypes.includes(entry.entityType)
    );
    saveDB(db);
    setRefreshKey(prev => prev + 1);
    toast({ title: 'Clinical activity cleared' });
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No recent clinical activity</p>
      </div>
    );
  }

  return (
    <div key={refreshKey}>
      <div className="divide-y divide-border">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-lg flex-shrink-0">
              {getActionIcon(activity.entityType)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{activity.details}</p>
              <p className="text-xs text-muted-foreground">{formatTimeAgo(activity.timestamp)}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-border">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full text-muted-foreground hover:text-destructive"
          onClick={handleClearActivity}
        >
          <Trash2 className="w-3 h-3 mr-2" />
          Clear Activity
        </Button>
      </div>
    </div>
  );
};

export default RecentActivity;
