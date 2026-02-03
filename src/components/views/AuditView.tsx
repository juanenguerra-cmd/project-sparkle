import { useState, useMemo } from 'react';
import { RefreshCw, Download, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SectionCard from '@/components/dashboard/SectionCard';
import { loadDB, saveDB } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { SortableTableHeader, useSortableTable } from '@/components/ui/sortable-table-header';
import { todayISO } from '@/lib/parsers';

const AuditView = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  const db = loadDB();
  const auditEntries = db.audit_log.slice(0, 100);

  // Date filter logic
  const getDateCutoff = () => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      case 'week':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo.toISOString();
      case 'month':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return monthAgo.toISOString();
      default:
        return null;
    }
  };

  const filteredEntries = auditEntries.filter(entry => {
    const matchesSearch = 
      entry.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEntity = entityFilter === 'all' || entry.entityType === entityFilter;
    
    const dateCutoff = getDateCutoff();
    const matchesDate = !dateCutoff || entry.timestamp >= dateCutoff;
    
    return matchesSearch && matchesEntity && matchesDate;
  });

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleClear = () => {
    const db = loadDB();
    db.audit_log = [];
    saveDB(db);
    setRefreshKey(prev => prev + 1);
    toast({ title: 'Audit log cleared' });
  };

  const handleExport = () => {
    const data = JSON.stringify(filteredEntries, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'census': return '👥';
      case 'abt': return '💊';
      case 'ip': return '🛡️';
      case 'vax': return '💉';
      case 'notes': return '📝';
      case 'settings': return '⚙️';
      case 'export': return '⬇️';
      case 'import': return '⬆️';
      default: return '🕘';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Audit Trail</h2>
          <p className="text-sm text-muted-foreground">Track all system actions and changes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="destructive" size="sm" onClick={handleClear}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-panel">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search actions, users, entities..." 
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="w-full md:w-48">
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="census">Census</SelectItem>
                <SelectItem value="abt">ABT</SelectItem>
                <SelectItem value="ip">IP</SelectItem>
                <SelectItem value="vax">VAX</SelectItem>
                <SelectItem value="notes">Notes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-40">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Audit List */}
      <SectionCard title={`Audit Entries (${filteredEntries.length})`}>
        <div className="space-y-3">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <span className="text-3xl mb-2 block">🕘</span>
              <p>No audit entries found</p>
              <p className="text-sm">Perform actions to see them tracked here</p>
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-4 p-4 bg-muted/30 rounded-lg border border-border">
                <div className="w-10 h-10 rounded-lg bg-card flex items-center justify-center text-lg flex-shrink-0">
                  {getEntityIcon(entry.entityType)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{entry.details}</p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatTime(entry.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge-status badge-muted text-xs">{entry.action}</span>
                    <span className="badge-status badge-muted text-xs">{entry.entityType}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
};

export default AuditView;
