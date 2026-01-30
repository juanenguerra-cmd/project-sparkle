import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { exportDBToJSON, importDBFromJSON, clearDB } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, Trash2 } from 'lucide-react';
import { todayISO } from '@/lib/parsers';
import ImportPreviewModal, { parseBackupPreview, BackupPreview, ImportMode } from './ImportPreviewModal';

interface DataManagementModalProps {
  open: boolean;
  onClose: () => void;
  onDataChange: () => void;
}

const DataManagementModal = ({ open, onClose, onDataChange }: DataManagementModalProps) => {
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExport = useCallback(() => {
    try {
      const json = exportDBToJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `icn_hub_backup_${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      
      toast({
        title: 'Data Exported',
        description: 'Database backup downloaded successfully'
      });
    } catch (err) {
      console.error('Export failed:', err);
      toast({
        title: 'Export Failed',
        description: 'Failed to export database',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const handleImportClick = useCallback(() => {
    console.log('Import button clicked, triggering file input');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed');
    const file = e.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    
    console.log('File selected:', file.name);
    setPendingFile(file);
    setPreviewLoading(true);
    setShowPreview(true);
    
    try {
      const backupPreview = await parseBackupPreview(file);
      console.log('Preview parsed:', backupPreview);
      setPreview(backupPreview);
    } catch (err) {
      console.error('Preview parse error:', err);
      setPreview({
        isValid: false,
        errors: ['Failed to parse backup file'],
        warnings: [],
        counts: { residents: 0, abt: 0, ipCases: 0, vax: 0, notes: 0, outbreaks: 0, contacts: 0 }
      });
    } finally {
      setPreviewLoading(false);
    }
    
    // Reset file input for re-selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleConfirmImport = useCallback(async (mode: ImportMode) => {
    if (!pendingFile) return;
    
    setShowPreview(false);
    setImporting(true);
    
    try {
      // If replace mode, clear existing data first
      if (mode === 'replace') {
        clearDB();
      }
      
      const text = await pendingFile.text();
      const result = await importDBFromJSON(text);
      
      if (result.success) {
        toast({
          title: mode === 'replace' ? 'Data Replaced' : 'Import Successful',
          description: result.message
        });
        onDataChange();
        onClose();
      } else {
        toast({
          title: 'Import Failed',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('Import error:', err);
      toast({
        title: 'Import Error',
        description: 'Failed to read file',
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
      setPendingFile(null);
      setPreview(null);
    }
  }, [pendingFile, toast, onDataChange, onClose]);

  const handleCancelPreview = useCallback(() => {
    setShowPreview(false);
    setPendingFile(null);
    setPreview(null);
  }, []);

  const handleClearData = useCallback(() => {
    const firstConfirm = window.confirm('Are you sure you want to clear ALL data? This cannot be undone.');
    if (!firstConfirm) return;
    
    const secondConfirm = window.confirm('This will delete all residents, ABT records, IP cases, vaccinations, and notes. Really proceed?');
    if (!secondConfirm) return;
    
    try {
      clearDB();
      toast({
        title: 'Data Cleared',
        description: 'All data has been deleted'
      });
      onDataChange();
      onClose();
    } catch (err) {
      console.error('Failed to clear data:', err);
      toast({
        title: 'Error',
        description: 'Failed to clear data',
        variant: 'destructive'
      });
    }
  }, [toast, onDataChange, onClose]);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Data Management</DialogTitle>
            <DialogDescription>
              Export your data for backup or import from a previous backup
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={handleExport}
            >
              <Download className="w-4 h-4 mr-2" />
              Export All Data (JSON)
            </Button>
            
            <div className="relative">
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".json,application/json"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                style={{ display: 'block' }}
              />
              <Button 
                variant="outline" 
                className="w-full justify-start pointer-events-none"
                disabled={importing}
              >
                <Upload className="w-4 h-4 mr-2" />
                {importing ? 'Importing...' : 'Import Data Backup'}
              </Button>
            </div>
            
            <div className="border-t pt-4 mt-4">
              <Button 
                variant="destructive" 
                className="w-full justify-start"
                onClick={handleClearData}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All Data
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Warning: This will permanently delete all data
              </p>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportPreviewModal
        open={showPreview}
        file={pendingFile}
        onClose={handleCancelPreview}
        onConfirm={handleConfirmImport}
        preview={preview}
        loading={previewLoading}
      />
    </>
  );
};

export default DataManagementModal;
