import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Download, Upload, X, Settings, Clock, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { exportDBToJSON, importDBFromJSON, loadDB, clearDB } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { todayISO } from '@/lib/parsers';
import { differenceInHours, differenceInDays, parseISO, format } from 'date-fns';
import ImportPreviewModal, { parseBackupPreview, BackupPreview, ImportMode } from '@/components/modals/ImportPreviewModal';

interface BackupSettings {
  reminderEnabled: boolean;
  reminderFrequency: 'daily' | 'weekly' | 'every3days';
  reminderTime: string; // HH:mm format
  lastBackupAt: string | null;
  lastReminderDismissedAt: string | null;
  showOnStartup: boolean;
  warnBeforeClose: boolean;
}

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  reminderEnabled: true,
  reminderFrequency: 'daily',
  reminderTime: '09:00',
  lastBackupAt: null,
  lastReminderDismissedAt: null,
  showOnStartup: true,
  warnBeforeClose: true,
};

const BACKUP_SETTINGS_KEY = 'icn_hub_backup_settings';

const loadBackupSettings = (): BackupSettings => {
  try {
    const stored = localStorage.getItem(BACKUP_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_BACKUP_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load backup settings:', e);
  }
  return DEFAULT_BACKUP_SETTINGS;
};

const saveBackupSettings = (settings: BackupSettings): void => {
  localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(settings));
};

interface BackupReminderBannerProps {
  onDataChange?: () => void;
}

const BackupReminderBanner = ({ onDataChange }: BackupReminderBannerProps) => {
  const [settings, setSettings] = useState<BackupSettings>(loadBackupSettings);
  const [showBanner, setShowBanner] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);
  
  // Preview modal state
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  
  const { toast } = useToast();

  // Check if backup reminder should show
  const shouldShowReminder = useCallback(() => {
    if (!settings.reminderEnabled) return false;
    
    const now = new Date();
    const lastBackup = settings.lastBackupAt ? parseISO(settings.lastBackupAt) : null;
    const lastDismissed = settings.lastReminderDismissedAt ? parseISO(settings.lastReminderDismissedAt) : null;
    
    // Calculate hours since last backup
    let hoursSinceBackup = Infinity;
    if (lastBackup) {
      hoursSinceBackup = differenceInHours(now, lastBackup);
    }
    
    // Calculate threshold based on frequency
    let thresholdHours = 24; // daily
    if (settings.reminderFrequency === 'every3days') thresholdHours = 72;
    if (settings.reminderFrequency === 'weekly') thresholdHours = 168;
    
    // Don't show if backed up recently
    if (hoursSinceBackup < thresholdHours) return false;
    
    // Don't show if dismissed in the last 4 hours
    if (lastDismissed && differenceInHours(now, lastDismissed) < 4) return false;
    
    return true;
  }, [settings]);

  // Check on mount and periodically
  useEffect(() => {
    // Check for first visit (show import prompt)
    const hasVisited = localStorage.getItem('icn_hub_has_visited');
    if (!hasVisited && settings.showOnStartup) {
      const db = loadDB();
      const hasData = Object.keys(db.census.residentsByMrn).length > 0 || 
                      db.records.abx.length > 0 || 
                      db.records.ip_cases.length > 0;
      
      if (!hasData) {
        setIsFirstVisit(true);
        setShowImportModal(true);
      }
      localStorage.setItem('icn_hub_has_visited', 'true');
    }
    
    // Check if reminder should show
    if (shouldShowReminder()) {
      setShowBanner(true);
    }
    
    // Set up periodic check
    const interval = setInterval(() => {
      if (shouldShowReminder()) {
        setShowBanner(true);
      }
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [shouldShowReminder, settings.showOnStartup]);

  // Browser close warning
  useEffect(() => {
    if (!settings.warnBeforeClose) return;
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const lastBackup = settings.lastBackupAt ? parseISO(settings.lastBackupAt) : null;
      const db = loadDB();
      const hasData = Object.keys(db.census.residentsByMrn).length > 0;
      
      // Only warn if there's data and no recent backup (within last 4 hours)
      if (hasData && (!lastBackup || differenceInHours(new Date(), lastBackup) > 4)) {
        e.preventDefault();
        e.returnValue = ''; // Required for Chrome
        return '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [settings.warnBeforeClose, settings.lastBackupAt]);

  const handleBackupNow = () => {
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
    
    // Update last backup time
    const newSettings = { ...settings, lastBackupAt: new Date().toISOString() };
    setSettings(newSettings);
    saveBackupSettings(newSettings);
    setShowBanner(false);
    
    toast({
      title: 'Backup Downloaded',
      description: 'Your data backup has been downloaded. Save it in a secure location.',
    });
  };

  const handleDismiss = () => {
    const newSettings = { ...settings, lastReminderDismissedAt: new Date().toISOString() };
    setSettings(newSettings);
    saveBackupSettings(newSettings);
    setShowBanner(false);
  };

  const handleSettingsSave = (newSettings: BackupSettings) => {
    setSettings(newSettings);
    saveBackupSettings(newSettings);
    setShowSettingsModal(false);
    toast({
      title: 'Backup Settings Saved',
      description: 'Your backup reminder preferences have been updated.',
    });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset input immediately
    e.target.value = '';
    
    // Show preview modal
    setPendingFile(file);
    setPreviewLoading(true);
    setShowPreview(true);
    setShowImportModal(false);
    
    try {
      const backupPreview = await parseBackupPreview(file);
      setPreview(backupPreview);
    } catch (err) {
      setPreview({
        isValid: false,
        errors: ['Failed to parse backup file'],
        warnings: [],
        counts: { residents: 0, abt: 0, ipCases: 0, vax: 0, notes: 0, outbreaks: 0, contacts: 0 }
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmImport = async (mode: ImportMode) => {
    if (!pendingFile) return;
    
    setShowPreview(false);
    
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
          description: result.message,
        });
        onDataChange?.();
      } else {
        toast({
          title: 'Import Failed',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Import Error',
        description: 'Failed to read file',
        variant: 'destructive',
      });
    } finally {
      setPendingFile(null);
      setPreview(null);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPendingFile(null);
    setPreview(null);
  };

  const getTimeSinceBackup = (): string => {
    if (!settings.lastBackupAt) return 'Never backed up';
    
    const lastBackup = parseISO(settings.lastBackupAt);
    const days = differenceInDays(new Date(), lastBackup);
    const hours = differenceInHours(new Date(), lastBackup);
    
    if (days > 0) return `Last backup: ${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `Last backup: ${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Last backup: Recently';
  };

  return (
    <>
      {/* Reminder Banner */}
      {showBanner && (
        <div className="bg-warning/10 border-b border-warning/30 px-4 py-3">
          <div className="container mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Backup Reminder
                </p>
                <p className="text-xs text-muted-foreground">
                  {getTimeSinceBackup()} • Regular backups protect your data
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowSettingsModal(true)}
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleBackupNow}
                className="bg-warning text-warning-foreground hover:bg-warning/90"
              >
                <Download className="w-4 h-4 mr-2" />
                Backup Now
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDismiss}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Backup Reminder Settings
            </DialogTitle>
            <DialogDescription>
              Configure when and how you want to be reminded to backup your data
            </DialogDescription>
          </DialogHeader>
          
          <BackupSettingsForm
            settings={settings}
            onSave={handleSettingsSave}
            onCancel={() => setShowSettingsModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Import Modal (shown on first visit) */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Welcome to ICN Hub
            </DialogTitle>
            <DialogDescription>
              {isFirstVisit 
                ? "It looks like you're starting fresh. Would you like to import a previous backup?"
                : "Import a backup file to restore your data"
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center relative">
              <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground mb-3">
                Select a backup JSON file to restore your data
              </p>
              <div className="relative inline-block">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  style={{ display: 'block' }}
                />
                <Button variant="outline" className="pointer-events-none">
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Backup File
                </Button>
              </div>
            </div>
            
            <div className="text-center">
              <Button variant="ghost" onClick={() => setShowImportModal(false)}>
                {isFirstVisit ? "Start Fresh" : "Cancel"}
              </Button>
            </div>
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

// Settings Form Component
interface BackupSettingsFormProps {
  settings: BackupSettings;
  onSave: (settings: BackupSettings) => void;
  onCancel: () => void;
}

const BackupSettingsForm = ({ settings, onSave, onCancel }: BackupSettingsFormProps) => {
  const [localSettings, setLocalSettings] = useState<BackupSettings>(settings);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="reminderEnabled">Enable Backup Reminders</Label>
          <Switch
            id="reminderEnabled"
            checked={localSettings.reminderEnabled}
            onCheckedChange={(checked) =>
              setLocalSettings({ ...localSettings, reminderEnabled: checked })
            }
          />
        </div>

        <div className="space-y-2">
          <Label>Reminder Frequency</Label>
          <Select
            value={localSettings.reminderFrequency}
            onValueChange={(value: 'daily' | 'weekly' | 'every3days') =>
              setLocalSettings({ ...localSettings, reminderFrequency: value })
            }
            disabled={!localSettings.reminderEnabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="every3days">Every 3 Days</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Preferred Reminder Time</Label>
          <Input
            type="time"
            value={localSettings.reminderTime}
            onChange={(e) =>
              setLocalSettings({ ...localSettings, reminderTime: e.target.value })
            }
            disabled={!localSettings.reminderEnabled}
          />
          <p className="text-xs text-muted-foreground">
            Note: Reminders will appear when you open the app near this time
          </p>
        </div>

        <div className="border-t pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="showOnStartup">Show Import Prompt on Startup</Label>
              <p className="text-xs text-muted-foreground">
                Remind to import backup when opening with no data
              </p>
            </div>
            <Switch
              id="showOnStartup"
              checked={localSettings.showOnStartup}
              onCheckedChange={(checked) =>
                setLocalSettings({ ...localSettings, showOnStartup: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="warnBeforeClose">Warn Before Closing Browser</Label>
              <p className="text-xs text-muted-foreground">
                Show warning if you have unsaved data
              </p>
            </div>
            <Switch
              id="warnBeforeClose"
              checked={localSettings.warnBeforeClose}
              onCheckedChange={(checked) =>
                setLocalSettings({ ...localSettings, warnBeforeClose: checked })
              }
            />
          </div>
        </div>

        {localSettings.lastBackupAt && (
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Last backup:</span>
              <span className="font-medium">
                {format(parseISO(localSettings.lastBackupAt), 'PPp')}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(localSettings)}>
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default BackupReminderBanner;
