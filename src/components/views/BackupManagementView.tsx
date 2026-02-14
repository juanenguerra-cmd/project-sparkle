import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Download, Upload, Save, Trash2, RotateCcw, Database, AlertCircle } from 'lucide-react';
import {
  createManualBackup,
  listBackups,
  restoreFromBackup,
  deleteBackup,
  exportBackupToFile,
  importBackupFromFile,
  getBackupStats,
} from '@/lib/backup';
import { requirePermission } from '@/lib/auth';
import { toast as sonnerToast } from 'sonner';

const BackupManagementView = () => {
  requirePermission('manage_settings');
  const [backups, setBackups] = useState<Array<{ id: string; timestamp: string; createdBy: string; type: string; totalRecords: number; sizeMB: number }>>([]);
  const [stats, setStats] = useState<ReturnType<typeof getBackupStats> | null>(null);

  useEffect(() => {
    const loadBackups = () => {
      setBackups(listBackups());
      setStats(getBackupStats());
    };
    loadBackups();
  }, []);

  const refresh = () => {
    setBackups(listBackups());
    setStats(getBackupStats());
  };

  const handleCreateBackup = () => {
    try {
      createManualBackup();
      refresh();
    } catch (error) {
      sonnerToast.error('Backup Failed', { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleRestore = (backupId: string) => {
    if (!window.confirm('This will restore the entire database to this backup point. Current data will be backed up first. Continue?')) return;
    try {
      restoreFromBackup(backupId);
    } catch (error) {
      sonnerToast.error('Restore Failed', { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleDelete = (backupId: string) => {
    if (!window.confirm('Delete this backup? This cannot be undone.')) return;
    try {
      deleteBackup(backupId);
      refresh();
    } catch (error) {
      sonnerToast.error('Delete Failed', { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        importBackupFromFile(String(event.target?.result || ''));
        refresh();
      } catch (error) {
        sonnerToast.error('Import Failed', { description: error instanceof Error ? error.message : String(error) });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Backup & Recovery</h1>
          <p className="text-muted-foreground">Manage database backups and restore points</p>
        </div>
        <div className="flex gap-2">
          <label>
            <Input type="file" accept=".json" onChange={handleImport} className="hidden" />
            <Button variant="outline" asChild>
              <span><Upload className="w-4 h-4 mr-2" />Import Backup</span>
            </Button>
          </label>
          <Button onClick={handleCreateBackup}><Save className="w-4 h-4 mr-2" />Create Backup</Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Backups</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalBackups}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Size</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{stats.totalSizeMB} MB</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Oldest Backup</CardTitle></CardHeader><CardContent><div className="text-sm">{stats.oldestBackup}</div></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Latest Backup</CardTitle></CardHeader><CardContent><div className="text-sm">{stats.newestBackup}</div></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Available Backups</CardTitle></CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Database className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No backups available</p></div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Timestamp</TableHead><TableHead>Type</TableHead><TableHead>Created By</TableHead><TableHead className="text-right">Records</TableHead><TableHead className="text-right">Size (MB)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-mono text-xs">{new Date(backup.timestamp).toLocaleString()}</TableCell>
                    <TableCell>{backup.type}</TableCell>
                    <TableCell>{backup.createdBy}</TableCell>
                    <TableCell className="text-right">{backup.totalRecords}</TableCell>
                    <TableCell className="text-right">{backup.sizeMB.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleRestore(backup.id)}><RotateCcw className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => exportBackupToFile(backup.id)}><Download className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(backup.id)}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Backup Best Practices</p>
              <ul className="space-y-1 text-blue-800">
                <li>• Backups are created automatically every 10 saves</li>
                <li>• Create manual backups before major operations</li>
                <li>• Export critical backups to external storage</li>
                <li>• Only the last 10 backups are kept automatically</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupManagementView;
