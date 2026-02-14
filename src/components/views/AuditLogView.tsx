import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Search, Download, Filter, Calendar,
  Eye, Edit, Trash2, Plus, ChevronLeft, ChevronRight
} from 'lucide-react';
import { loadDB } from '@/lib/database';
import { AuditLog } from '@/lib/types';
import { requirePermission } from '@/lib/auth';
import { exportAuditLogs } from '@/lib/audit';
import { toast as sonnerToast } from 'sonner';

const AuditLogView = () => {
  requirePermission('manage_settings');

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterEntityType, setFilterEntityType] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = () => {
    const db = loadDB();
    const logs = (db.audit_log || []).map((entry) => {
      const [entityPrefix, actionSuffix] = entry.action.includes('_')
        ? [entry.action.split('_').slice(0, -1).join('_'), entry.action.split('_').at(-1)]
        : [entry.entityType, 'update'];

      const action = (['create', 'update', 'delete'].includes(actionSuffix || '')
        ? actionSuffix
        : 'update') as AuditLog['action'];

      const entityTypeMap: Record<string, AuditLog['entity_type']> = {
        census: 'resident',
        ip: 'ip_case',
        ip_case: 'ip_case',
        abt: 'abt',
        vax: 'vax',
        notes: 'note',
        note: 'note',
      };

      const entity_type = entityTypeMap[entityPrefix] || entityTypeMap[entry.entityType] || 'note';

      const changes: AuditLog['changes'] = entry.before || entry.after
        ? Object.keys({ ...(entry.before || {}), ...(entry.after || {}) }).reduce((acc, key) => {
            acc[key] = {
              old: entry.before?.[key] ?? null,
              new: entry.after?.[key] ?? null,
            };
            return acc;
          }, {} as NonNullable<AuditLog['changes']>)
        : undefined;

      return {
        id: entry.id,
        timestamp: entry.timestamp,
        user: entry.user || 'System',
        userId: 'legacy',
        action,
        entity_type,
        entity_id: entry.entityId || 'n/a',
        entity_name: entry.details,
        changes,
      } satisfies AuditLog;
    });

    setAuditLogs(logs);
  };

  const uniqueUsers = useMemo(() => {
    const users = new Set(auditLogs.map(log => log.user));
    return Array.from(users).sort();
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch =
          log.entity_name?.toLowerCase().includes(searchLower) ||
          log.entity_id.toLowerCase().includes(searchLower) ||
          log.user.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      if (filterAction !== 'all' && log.action !== filterAction) {
        return false;
      }

      if (filterEntityType !== 'all' && log.entity_type !== filterEntityType) {
        return false;
      }

      if (filterUser !== 'all' && log.user !== filterUser) {
        return false;
      }

      if (startDate) {
        const logDate = new Date(log.timestamp);
        const start = new Date(startDate);
        if (logDate < start) return false;
      }

      if (endDate) {
        const logDate = new Date(log.timestamp);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (logDate > end) return false;
      }

      return true;
    });
  }, [auditLogs, searchTerm, filterAction, filterEntityType, filterUser, startDate, endDate]);

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleExport = () => {
    try {
      const csv = exportAuditLogs(filteredLogs);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      sonnerToast.success('Audit Log Exported', {
        description: `${filteredLogs.length} records exported`
      });
    } catch (error: any) {
      sonnerToast.error('Export Failed', {
        description: error.message
      });
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterAction('all');
    setFilterEntityType('all');
    setFilterUser('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const getActionBadge = (action: string) => {
    const colors = {
      create: 'bg-green-100 text-green-800',
      update: 'bg-blue-100 text-blue-800',
      delete: 'bg-red-100 text-red-800',
    };

    const icons = {
      create: <Plus className="w-3 h-3" />,
      update: <Edit className="w-3 h-3" />,
      delete: <Trash2 className="w-3 h-3" />,
    };

    return (
      <Badge className={`${colors[action as keyof typeof colors] || 'bg-gray-100 text-gray-800'} flex items-center gap-1`}>
        {icons[action as keyof typeof icons]}
        {action}
      </Badge>
    );
  };

  const getEntityTypeBadge = (entityType: string) => {
    const colors = {
      resident: 'bg-purple-100 text-purple-800',
      ip_case: 'bg-red-100 text-red-800',
      abt: 'bg-orange-100 text-orange-800',
      vax: 'bg-blue-100 text-blue-800',
      note: 'bg-gray-100 text-gray-800',
    };

    return (
      <Badge className={colors[entityType as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {entityType.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Audit Log</h1>
          <p className="text-muted-foreground">
            Complete audit trail of all system changes
          </p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export ({filteredLogs.length})
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search by entity name, ID, or user..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="action">Action</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger id="action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="entityType">Entity Type</Label>
              <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                <SelectTrigger id="entityType">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="ip_case">IP Case</SelectItem>
                  <SelectItem value="abt">Antibiotic</SelectItem>
                  <SelectItem value="vax">Vaccine</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="user">User</Label>
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger id="user">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {uniqueUsers.map(user => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="startDate"
                  type="date"
                  className="pl-10"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="endDate"
                  type="date"
                  className="pl-10"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <span className="font-medium">Results:</span> {filteredLogs.length} of {auditLogs.length} records
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {paginatedLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
              <p className="text-sm mt-2">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Entity Name</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>{getEntityTypeBadge(log.entity_type)}</TableCell>
                        <TableCell className="font-medium">{log.user}</TableCell>
                        <TableCell>
                          {log.entity_name || log.entity_id}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedLog && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLog(null)}
        >
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Audit Log Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Timestamp</Label>
                  <div className="font-mono text-sm">
                    {new Date(selectedLog.timestamp).toLocaleString()}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">User</Label>
                  <div className="font-medium">{selectedLog.user}</div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Action</Label>
                  <div>{getActionBadge(selectedLog.action)}</div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Entity Type</Label>
                  <div>{getEntityTypeBadge(selectedLog.entity_type)}</div>
                </div>

                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Entity ID</Label>
                  <div className="font-mono text-sm">{selectedLog.entity_id}</div>
                </div>

                {selectedLog.entity_name && (
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Entity Name</Label>
                    <div className="font-medium">{selectedLog.entity_name}</div>
                  </div>
                )}
              </div>

              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Changes</Label>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {Object.entries(selectedLog.changes).map(([field, change]) => (
                      <div key={field} className="border-b border-gray-200 pb-2 last:border-0">
                        <div className="font-semibold text-sm">{field}</div>
                        <div className="grid grid-cols-2 gap-4 mt-1 text-sm">
                          <div>
                            <span className="text-muted-foreground">Old:</span>{' '}
                            <span className="text-red-600 line-through">
                              {JSON.stringify(change.old)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">New:</span>{' '}
                            <span className="text-green-600 font-medium">
                              {JSON.stringify(change.new)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setSelectedLog(null)}>Close</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AuditLogView;
