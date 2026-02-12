import { useState } from 'react';
import { Save, TestTube, FileText, BookOpen, Download, ScrollText, FileEdit, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import SectionCard from '@/components/dashboard/SectionCard';
import LineListingFieldsSettings from '@/components/settings/LineListingFieldsSettings';
import { loadDB, saveDB, addAudit } from '@/lib/database';
import { useToast } from '@/hooks/use-toast';
import { generateUserGuidePdf, generateTrackerCapabilitiesPdf } from '@/lib/pdf/userGuidePdf';
import { generateReleaseNotesPdf } from '@/lib/pdf/releaseNotesPdf';
import { downloadUserGuideAsWord } from '@/lib/userGuideHtml';
import type { CustomLineListingConfig } from '@/lib/lineListingTemplates';
import { REGULATORY_REFERENCES } from '@/lib/regulatory';
const SettingsView = () => {
  const { toast } = useToast();
  const db = loadDB();
  
  const [facilityName, setFacilityName] = useState(db.settings.facilityName || '');
  const [abtReviewCadence, setAbtReviewCadence] = useState(String(db.settings.abtReviewCadence));
  const [autoCloseCensus, setAutoCloseCensus] = useState(db.settings.autoCloseCensus);
  const [autoCloseGraceDays, setAutoCloseGraceDays] = useState(db.settings.autoCloseGraceDays);
  const [ebpReviewDays, setEbpReviewDays] = useState(db.settings.ipRules.ebpReviewDays);
  const [isolationReviewDays, setIsolationReviewDays] = useState(db.settings.ipRules.isolationReviewDays);
  const [oneDriveEnabled, setOneDriveEnabled] = useState(db.settings.oneDriveBackup?.enabled ?? false);
  const [oneDriveFolderPath, setOneDriveFolderPath] = useState(db.settings.oneDriveBackup?.folderPath ?? '');
  const [lineListingConfigs, setLineListingConfigs] = useState<Record<string, CustomLineListingConfig>>(
    (db.settings.lineListingConfigs as Record<string, CustomLineListingConfig>) || {}
  );
  const [showLineListingSettings, setShowLineListingSettings] = useState(false);
  const [isolationStatusLine, setIsolationStatusLine] = useState(
    db.settings.admissionNoteTemplates?.isolationStatusLine || 'Current admission isolation status: {isolationStatus}.'
  );
  const [paperworkReviewLine, setPaperworkReviewLine] = useState(
    db.settings.admissionNoteTemplates?.paperworkReviewLine || 'Resident admission paperwork was reviewed.'
  );
  const [antibioticStatusLine, setAntibioticStatusLine] = useState(
    db.settings.admissionNoteTemplates?.antibioticStatusLine || 'On admission, resident antibiotic status: {antibioticStatus}.'
  );

  const handleSaveSettings = () => {
    const db = loadDB();
    db.settings = {
      ...db.settings,
      facilityName,
      abtReviewCadence: parseInt(abtReviewCadence),
      autoCloseCensus,
      autoCloseGraceDays,
      ipRules: {
        ...db.settings.ipRules,
        ebpReviewDays,
        isolationReviewDays,
      },
      oneDriveBackup: {
        enabled: oneDriveEnabled,
        folderPath: oneDriveFolderPath.trim(),
      },
      lineListingConfigs,
      admissionNoteTemplates: {
        isolationStatusLine: isolationStatusLine.trim(),
        paperworkReviewLine: paperworkReviewLine.trim(),
        antibioticStatusLine: antibioticStatusLine.trim(),
      },
    };
    addAudit(db, 'settings_updated', `Facility: ${facilityName}`, 'settings');
    saveDB(db);
    toast({
      title: 'Settings Saved',
      description: 'Your settings have been updated successfully.',
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground">Configure application preferences</p>
        </div>
        <Button size="sm" onClick={handleSaveSettings}>
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>

      {/* System Checks */}
      <SectionCard 
        title="System Checks"
        actions={
          <Button variant="outline" size="sm">
            <TestTube className="w-4 h-4 mr-2" />
            Run Checks
          </Button>
        }
      >
        <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm max-h-48 overflow-auto">
          Click "Run Checks" to scan the database.
        </div>
      </SectionCard>



      <SectionCard title="Reference / Regulatory">
        <Collapsible>
          <CollapsibleTrigger className="w-full flex items-center justify-between rounded-md border px-3 py-2 text-sm">
            <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Regulatory References</span>
            <ChevronDown className="w-4 h-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3 text-sm">
            {Object.values(REGULATORY_REFERENCES).map((ref) => (
              <div key={ref.ftag} className="rounded-md border p-3">
                <p className="font-semibold">{ref.ftag}: {ref.title}</p>
                <p className="text-muted-foreground">{ref.citation} • {ref.cmsTask}</p>
                <p>{ref.plainLanguage}</p>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </SectionCard>

      {/* Application Settings */}
      <div className="grid md:grid-cols-2 gap-6">
        <SectionCard title="Workflow Settings">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>ABT Review Cadence</Label>
              <Select value={abtReviewCadence} onValueChange={setAbtReviewCadence}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="72">72 hours</SelectItem>
                  <SelectItem value="96">96 hours</SelectItem>
                  <SelectItem value="120">120 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Auto-close on Census Drop</Label>
                <Switch checked={autoCloseCensus} onCheckedChange={setAutoCloseCensus} />
              </div>
              <p className="text-sm text-muted-foreground">
                Auto-resolve IP precautions and discontinue ABX when a resident is no longer active on census.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Grace Period (Days)</Label>
              <Input 
                type="number" 
                value={autoCloseGraceDays} 
                onChange={(e) => setAutoCloseGraceDays(parseInt(e.target.value) || 0)}
                min={0} 
                max={14}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="IP Review Rules">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>EBP Review Interval (Days)</Label>
              <Input 
                type="number" 
                value={ebpReviewDays} 
                onChange={(e) => setEbpReviewDays(parseInt(e.target.value) || 7)}
                min={1} 
                max={30}
              />
              <p className="text-sm text-muted-foreground">
                How often EBP cases should be reviewed
              </p>
            </div>

            <div className="space-y-2">
              <Label>Isolation Review Interval (Days)</Label>
              <Input 
                type="number" 
                value={isolationReviewDays} 
                onChange={(e) => setIsolationReviewDays(parseInt(e.target.value) || 3)}
                min={1} 
                max={14}
              />
              <p className="text-sm text-muted-foreground">
                How often isolation cases should be reviewed
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Facility Information">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Facility Name</Label>
              <Input 
                value={facilityName} 
                onChange={(e) => setFacilityName(e.target.value)}
                placeholder="Enter facility name"
              />
              <p className="text-sm text-muted-foreground">
                This name appears on all generated reports
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Admission Progress Note Templates">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Isolation Status Line</Label>
              <Textarea
                value={isolationStatusLine}
                onChange={(e) => setIsolationStatusLine(e.target.value)}
                className="min-h-[70px]"
              />
              <p className="text-xs text-muted-foreground">Use <code>{'{isolationStatus}'}</code> token to inject status (e.g., on isolation, on enhanced barrier, or not on isolation).</p>
            </div>
            <div className="space-y-2">
              <Label>Admission Paperwork Review Line</Label>
              <Textarea
                value={paperworkReviewLine}
                onChange={(e) => setPaperworkReviewLine(e.target.value)}
                className="min-h-[70px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Antibiotic Status Line</Label>
              <Textarea
                value={antibioticStatusLine}
                onChange={(e) => setAntibioticStatusLine(e.target.value)}
                className="min-h-[70px]"
              />
              <p className="text-xs text-muted-foreground">Use <code>{'{antibioticStatus}'}</code> token to inject admission antibiotic wording.</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Data Management">
          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              Export All Data
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Import Data Backup
            </Button>
            <Button variant="destructive" className="w-full justify-start">
              Clear All Data
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="OneDrive Backup Sync">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Enable OneDrive Backup Location</Label>
              <Switch checked={oneDriveEnabled} onCheckedChange={setOneDriveEnabled} />
            </div>
            <div className="space-y-2">
              <Label>OneDrive Folder Path</Label>
              <Input
                value={oneDriveFolderPath}
                onChange={(e) => setOneDriveFolderPath(e.target.value)}
                placeholder="e.g. C:\\Users\\Name\\OneDrive\\ICN Hub Backups"
                disabled={!oneDriveEnabled}
              />
              <p className="text-sm text-muted-foreground">
                Use a locally synced OneDrive folder to save exports and select imports. Keep the path consistent across devices.
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Documentation">
          <div className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                const doc = generateUserGuidePdf(facilityName || 'Healthcare Facility');
                doc.save('ICN_Hub_User_Guide.pdf');
                toast({
                  title: 'User Guide Downloaded',
                  description: 'The comprehensive user guide PDF has been saved'
                });
              }}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Download User Guide (PDF)
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                downloadUserGuideAsWord(facilityName || 'Healthcare Facility');
                toast({
                  title: 'User Guide Downloaded',
                  description: 'Editable Word document has been saved - add your screenshots!'
                });
              }}
            >
              <FileEdit className="w-4 h-4 mr-2" />
              Download User Guide (Word - Editable)
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                const doc = generateTrackerCapabilitiesPdf(facilityName || 'Healthcare Facility');
                doc.save('ICN_Hub_Tracker_Capabilities.pdf');
                toast({
                  title: 'Capabilities List Downloaded',
                  description: 'The tracker capabilities summary PDF has been saved'
                });
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Download Capabilities List (PDF)
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => {
                const doc = generateReleaseNotesPdf(facilityName || 'Healthcare Facility');
                doc.save('ICN_Hub_Release_Notes.pdf');
                toast({
                  title: 'Release Notes Downloaded',
                  description: 'Feature milestones and capabilities PDF has been saved'
                });
              }}
            >
              <ScrollText className="w-4 h-4 mr-2" />
              Download Release Notes (PDF)
            </Button>
            <p className="text-xs text-muted-foreground">
              Download documentation for training and reference. The Word guide includes placeholders for screenshots.
            </p>
          </div>
        </SectionCard>
      </div>

      {/* Line Listing Form Configuration */}
      <Collapsible open={showLineListingSettings} onOpenChange={setShowLineListingSettings}>
        <SectionCard 
          title="Line Listing Form Configuration"
          actions={
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={`w-4 h-4 transition-transform ${showLineListingSettings ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          }
        >
          <CollapsibleContent>
            <LineListingFieldsSettings
              customConfigs={lineListingConfigs}
              onSave={(configs) => {
                setLineListingConfigs(configs);
                // Auto-save when configs change
                const db = loadDB();
                db.settings.lineListingConfigs = configs;
                saveDB(db);
              }}
            />
          </CollapsibleContent>
          {!showLineListingSettings && (
            <p className="text-sm text-muted-foreground">
              Click to expand and customize line listing form fields for each outbreak type
            </p>
          )}
        </SectionCard>
      </Collapsible>
    </div>
  );
};

export default SettingsView;
