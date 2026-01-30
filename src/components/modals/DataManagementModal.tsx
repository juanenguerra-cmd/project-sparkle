import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { exportDBToJSON, importDBFromJSON, clearDB } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { todayISO } from '@/lib/parsers';

type ImportMode = 'merge' | 'replace';

interface DataManagementModalProps {
  open: boolean;
  onClose: () => void;
  onDataChange: () => void;
}

const DataManagementModal = ({ open, onClose, onDataChange }: DataManagementModalProps) => {
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExport = () => {
    const json = exportDBToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `icn_hub_backup_${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    
    toast({
      title: 'Data Exported',
      description: 'Database backup downloaded successfully'
    });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setPendingFile(file);
    setShowConfirmDialog(true);
    
    // Reset file input for re-selection
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    
    setShowConfirmDialog(false);
    setImporting(true);
    
    try {
      // If replace mode, clear existing data first
      if (importMode === 'replace') {
        clearDB();
      }
      
      const text = await pendingFile.text();
      const result = await importDBFromJSON(text);
      
      if (result.success) {
        toast({
          title: importMode === 'replace' ? 'Data Replaced' : 'Import Successful',
          description: result.message
        });
        onDataChange();
      } else {
        toast({
          title: 'Import Failed',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: 'Import Error',
        description: 'Failed to read file',
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
      setPendingFile(null);
    }
  };

  const handleCancelImport = () => {
    setShowConfirmDialog(false);
    setPendingFile(null);
  };

  const handleClearData = () => {
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
  };

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
            
            {/* Import Mode Selection */}
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <Label className="text-sm font-medium">Import Mode</Label>
              <RadioGroup
                value={importMode}
                onValueChange={(v) => setImportMode(v as ImportMode)}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="merge" id="merge" />
                  <Label htmlFor="merge" className="text-sm font-normal cursor-pointer">
                    Merge with existing data
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="replace" id="replace" />
                  <Label htmlFor="replace" className="text-sm font-normal cursor-pointer">
                    Replace all existing data
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                {importMode === 'merge' 
                  ? 'New records will be added. Existing records with the same ID will be updated.'
                  : 'All current data will be cleared before importing.'}
              </p>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={handleImportClick}
              disabled={importing}
            >
              <Upload className="w-4 h-4 mr-2" />
              {importing ? 'Importing...' : 'Import Data Backup'}
            </Button>
            
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
            
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

      {/* Import Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {importMode === 'replace' && <AlertTriangle className="w-5 h-5 text-destructive" />}
              Confirm Import
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>File:</strong> {pendingFile?.name}
              </p>
              <p>
                <strong>Mode:</strong> {importMode === 'merge' ? 'Merge with existing data' : 'Replace all existing data'}
              </p>
              {importMode === 'replace' && (
                <p className="text-destructive font-medium">
                  Warning: This will permanently delete all current data before importing!
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelImport}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmImport}
              className={importMode === 'replace' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {importMode === 'replace' ? 'Replace & Import' : 'Merge & Import'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DataManagementModal;
