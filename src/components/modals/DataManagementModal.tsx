import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { exportDBToJSON, importDBFromJSON, clearDB } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, Trash2 } from 'lucide-react';
import { todayISO } from '@/lib/parsers';

interface DataManagementModalProps {
  open: boolean;
  onClose: () => void;
  onDataChange: () => void;
}

const DataManagementModal = ({ open, onClose, onDataChange }: DataManagementModalProps) => {
  const [importing, setImporting] = useState(false);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    try {
      const text = await file.text();
      const result = importDBFromJSON(text);
      
      if (result.success) {
        toast({
          title: 'Import Successful',
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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
  );
};

export default DataManagementModal;
