# Integration Guide - Priority Features

## Overview
This guide provides step-by-step instructions for integrating the newly implemented priority fixes into the Project Sparkle application.

## ✅ Completed Features

### 1. Validation System
**Files**: `src/lib/validation.ts`

#### Integration Steps:

**A. Import validation functions:**
```typescript
import { 
  validateWithOverride, 
  ResidentSchema, 
  ABTRecordSchema,
  IPCaseSchema,
  VaxRecordSchema,
  checkDuplicateMRN,
  validateCensusImport 
} from '@/lib/validation';
```

**B. Add validation to form submission:**
```typescript
// In ResidentForm.tsx or similar
const handleSubmit = (data: Resident) => {
  // Check for duplicate MRN
  const dupCheck = checkDuplicateMRN(
    data.mrn, 
    database.census.residentsByMrn,
    data.id // Exclude current resident if editing
  );
  
  if (dupCheck.isDuplicate) {
    setWarning(`MRN ${data.mrn} already exists for ${dupCheck.existingResident.name}`);
    // Show override dialog
    setShowOverrideDialog(true);
    return;
  }
  
  // Validate data
  const result = validateWithOverride(ResidentSchema, data);
  
  if (!result.success) {
    if (result.canOverride) {
      setErrors(result.errors);
      setShowOverrideDialog(true);
    } else {
      setErrors(result.errors);
      return; // Block save
    }
  } else {
    saveResident(result.data);
  }
};
```

**C. Create Override Dialog Component:**
```typescript
// components/OverrideDialog.tsx
interface OverrideDialogProps {
  errors: string[];
  onOverride: () => void;
  onCancel: () => void;
}

export function OverrideDialog({ errors, onOverride, onCancel }: OverrideDialogProps) {
  return (
    <Dialog>
      <DialogTitle>Validation Warnings</DialogTitle>
      <DialogContent>
        <Alert severity="warning">
          The following validation issues were found:
          <ul>
            {errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </Alert>
        <Typography>Do you want to save anyway?</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={onOverride} color="warning">Override & Save</Button>
      </DialogActions>
    </Dialog>
  );
}
```

---

### 2. Backup System
**Files**: `src/lib/backup.ts`

#### Integration Steps:

**A. Initialize on app load:**
```typescript
// In App.tsx or main application component
import { initializeAutoBackup, getBackupSummary } from '@/lib/backup';
import { useEffect } from 'react';

function App() {
  const { database } = useDatabase();
  
  useEffect(() => {
    if (database) {
      initializeAutoBackup(database);
    }
  }, [database]);
  
  // Rest of app...
}
```

**B. Add backup button to settings:**
```typescript
// In SettingsView.tsx
import { triggerManualBackup, getBackupSummary } from '@/lib/backup';

function SettingsView() {
  const { database } = useDatabase();
  const backupSummary = getBackupSummary();
  
  return (
    <div>
      <Card>
        <CardHeader>Backup & Data Safety</CardHeader>
        <CardContent>
          <div>
            <Typography>Last Backup: {backupSummary.lastBackupDate || 'Never'}</Typography>
            <Typography>Local Backups: {backupSummary.localBackupCount}</Typography>
            {backupSummary.isDue && (
              <Alert severity="warning">Backup is overdue!</Alert>
            )}
          </div>
          <Button onClick={() => triggerManualBackup(database)}>
            Create Backup Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**C. Add restore functionality:**
```typescript
// In SettingsView.tsx
import { importBackup } from '@/lib/backup';

const handleRestore = async (file: File) => {
  try {
    const backup = await importBackup(file);
    
    if (confirm(`Restore backup from ${backup.metadata.timestamp}?\nThis will replace all current data.`)) {
      await database.restore(backup.data);
      window.location.reload();
    }
  } catch (error) {
    alert('Failed to restore backup: ' + error.message);
  }
};

return (
  <input 
    type="file" 
    accept=".json" 
    onChange={(e) => e.target.files?.[0] && handleRestore(e.target.files[0])} 
  />
);
```

---

### 3. Alert System
**Files**: `src/lib/alerts.ts`

#### Integration Steps:

**A. Create Dashboard Alert Widget:**
```typescript
// components/AlertsWidget.tsx
import { generateAllAlerts, Alert, AlertSeverity } from '@/lib/alerts';
import { useMemo } from 'react';

export function AlertsWidget() {
  const { database } = useDatabase();
  
  const alerts = useMemo(() => {
    return generateAllAlerts(database);
  }, [database]);
  
  const severityColors: Record<AlertSeverity, string> = {
    critical: 'error',
    warning: 'warning',
    info: 'info',
  };
  
  return (
    <Card>
      <CardHeader>
        Alerts ({alerts.length})
        <Badge badgeContent={alerts.filter(a => a.severity === 'critical').length} color="error" />
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <Typography color="textSecondary">No alerts</Typography>
        ) : (
          <List>
            {alerts.slice(0, 5).map((alert) => (
              <ListItem key={alert.id}>
                <Alert severity={severityColors[alert.severity]}>
                  <AlertTitle>{alert.title}</AlertTitle>
                  {alert.message}
                  {alert.actionUrl && (
                    <Button size="small" href={alert.actionUrl}>
                      {alert.actionLabel}
                    </Button>
                  )}
                </Alert>
              </ListItem>
            ))}
          </List>
        )}
        {alerts.length > 5 && (
          <Button>View All {alerts.length} Alerts</Button>
        )}
      </CardContent>
    </Card>
  );
}
```

**B. Add to Dashboard:**
```typescript
// In Dashboard.tsx
import { AlertsWidget } from '@/components/AlertsWidget';

function Dashboard() {
  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <AlertsWidget />
      </Grid>
      {/* Other dashboard widgets */}
    </Grid>
  );
}
```

---

### 4. Global Search
**Files**: `src/lib/globalSearch.ts`

#### Integration Steps:

**A. Create Search Bar Component:**
```typescript
// components/GlobalSearchBar.tsx
import { globalSearch, SearchResult } from '@/lib/globalSearch';
import { useState, useCallback } from 'react';
import debounce from 'lodash/debounce';

export function GlobalSearchBar() {
  const { database } = useDatabase();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  
  const handleSearch = useCallback(
    debounce((q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      const searchResults = globalSearch(database, q);
      setResults(searchResults);
      setOpen(true);
    }, 300),
    [database]
  );
  
  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'resident': return '👤';
      case 'abt': return '💊';
      case 'ip': return '🦠';
      case 'vaccination': return '💉';
      case 'note': return '📝';
      case 'outbreak': return '⚠️';
    }
  };
  
  return (
    <Autocomplete
      options={results}
      open={open}
      onClose={() => setOpen(false)}
      getOptionLabel={(option) => option.title}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search residents, medications, infections..."
          onChange={(e) => {
            setQuery(e.target.value);
            handleSearch(e.target.value);
          }}
        />
      )}
      renderOption={(props, option) => (
        <li {...props}>
          <div>
            <Typography variant="body2">
              {getTypeIcon(option.type)} {option.title}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {option.subtitle}
            </Typography>
          </div>
        </li>
      )}
      onChange={(_, value) => {
        if (value) {
          window.location.href = value.url;
        }
      }}
    />
  );
}
```

**B. Add to Navigation Bar:**
```typescript
// In NavigationBar.tsx
import { GlobalSearchBar } from '@/components/GlobalSearchBar';

function NavigationBar() {
  return (
    <AppBar>
      <Toolbar>
        <Logo />
        <Box sx={{ flexGrow: 1, mx: 2 }}>
          <GlobalSearchBar />
        </Box>
        <UserMenu />
      </Toolbar>
    </AppBar>
  );
}
```

---

### 5. Vaccine Series Tracking
**Files**: `src/lib/vaccineSeriesTracking.ts`

#### Integration Steps:

**A. Auto-calculate due dates on vaccination:**
```typescript
// In VaccinationForm.tsx
import { updateSeriesDueDates, getVaccineSeriesStatus } from '@/lib/vaccineSeriesTracking';

const handleVaccinationGiven = async (vaxRecord: VaxRecord) => {
  // Save the vaccination
  await saveVaccination(vaxRecord);
  
  // Get all vaccinations for this resident
  const residentVaxHistory = database.records.vax.filter(
    v => v.mrn === vaxRecord.mrn
  );
  
  // Calculate next due date
  const nextDueDate = updateSeriesDueDates(vaxRecord, residentVaxHistory);
  
  if (nextDueDate) {
    // Auto-create next dose record
    const nextDoseRecord: VaxRecord = {
      ...vaxRecord,
      id: `vax_${Date.now()}_next`,
      status: 'due',
      dateGiven: undefined,
      dueDate: nextDueDate,
      notes: 'Auto-generated from series tracking',
    };
    
    await saveVaccination(nextDoseRecord);
    
    toast.success(`Next dose scheduled for ${nextDueDate}`);
  }
};
```

**B. Display series status:**
```typescript
// In VaccinationList.tsx
import { getVaccineSeriesStatus } from '@/lib/vaccineSeriesTracking';

function VaccinationList({ mrn }: { mrn: string }) {
  const { database } = useDatabase();
  const residentVax = database.records.vax.filter(v => v.mrn === mrn);
  
  const covidStatus = getVaccineSeriesStatus('COVID-19', residentVax);
  const shingrixStatus = getVaccineSeriesStatus('Shingrix', residentVax);
  
  return (
    <div>
      <Card>
        <CardHeader>COVID-19 Vaccine</CardHeader>
        <CardContent>
          <Typography>
            Status: {covidStatus.currentDose} of {covidStatus.totalDoses} doses
          </Typography>
          {covidStatus.nextDueDate && (
            <Typography color={covidStatus.isOverdue ? 'error' : 'inherit'}>
              Next due: {covidStatus.nextDueDate}
              {covidStatus.isOverdue && ' (OVERDUE)'}
            </Typography>
          )}
          {covidStatus.isComplete && (
            <Chip label="Series Complete" color="success" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 6. Outbreak Detection
**Files**: `src/lib/outbreakDetection.ts`

#### Integration Steps:

**A. Run detection on dashboard load:**
```typescript
// In Dashboard.tsx
import { detectPotentialOutbreaks } from '@/lib/outbreakDetection';
import { useMemo } from 'react';

function Dashboard() {
  const { database } = useDatabase();
  
  const outbreakDetections = useMemo(() => {
    return detectPotentialOutbreaks(
      database.records.ip_cases,
      database.census.residentsByMrn,
      database.records.outbreaks
    );
  }, [database]);
  
  return (
    <div>
      {outbreakDetections.length > 0 && (
        <Alert severity="error">
          <AlertTitle>Potential Outbreak Detected!</AlertTitle>
          {outbreakDetections.map((detection, i) => (
            <div key={i}>
              <Typography>
                {detection.caseCount} {detection.category} cases in {detection.timeWindow} hours
              </Typography>
              <Button onClick={() => handleDeclareOutbreak(detection)}>
                Declare {detection.recommendation === 'declare_active' ? 'Active' : 'Watch'} Outbreak
              </Button>
            </div>
          ))}
        </Alert>
      )}
    </div>
  );
}
```

**B. Auto-create watch outbreaks:**
```typescript
// In OutbreakManagement.tsx
import { createWatchOutbreak, suggestLineListingCandidates } from '@/lib/outbreakDetection';

const handleDeclareOutbreak = async (detection: OutbreakDetection) => {
  const outbreak = createWatchOutbreak(detection);
  await database.saveOutbreak(outbreak);
  
  // Suggest residents for line listing
  const candidates = suggestLineListingCandidates(detection);
  
  navigate(`/outbreak?id=${outbreak.id}`, {
    state: { suggestedResidents: candidates }
  });
};
```

---

## Testing Checklist

### Validation
- [ ] Test duplicate MRN detection
- [ ] Test date validation (start < end)
- [ ] Test required field enforcement
- [ ] Test override dialog workflow
- [ ] Test census import validation

### Backup
- [ ] Test daily backup prompt
- [ ] Test manual backup export
- [ ] Test backup import/restore
- [ ] Test backup file integrity
- [ ] Test old backup cleanup

### Alerts
- [ ] Test ABT overdue alert generation
- [ ] Test IP case review alerts
- [ ] Test vaccination due alerts
- [ ] Test outbreak threshold detection
- [ ] Test census staleness warning

### Search
- [ ] Test search by resident name
- [ ] Test search by MRN
- [ ] Test search by medication
- [ ] Test search performance (100+ residents)
- [ ] Test result ranking accuracy

### Vaccine Series
- [ ] Test COVID-19 series tracking
- [ ] Test Shingrix series tracking
- [ ] Test auto due date calculation
- [ ] Test booster scheduling
- [ ] Test reoffer logic

### Outbreak Detection
- [ ] Test respiratory outbreak detection
- [ ] Test GI outbreak detection
- [ ] Test unit clustering logic
- [ ] Test auto-escalation from watch to active
- [ ] Test line listing suggestions

---

## Performance Considerations

### Validation
- Validation runs synchronously on form submission
- Estimated: <50ms for typical form
- No performance impact expected

### Backup
- Export runs in main thread
- Large databases (1000+ records) may take 2-3 seconds
- Consider Web Worker for large exports

### Alerts
- Alert generation runs on every render
- Use `useMemo` to cache results
- Estimated: <100ms for 100 residents

### Search
- Search runs in main thread
- Debounced to 300ms
- Estimated: <200ms for 500 records
- Consider indexing for >1000 records

### Outbreak Detection
- Runs on dashboard load
- Estimated: <50ms for 50 IP cases
- Cache results if running frequently

---

## Next Steps

1. **Complete UI Integration**: Create components for all features
2. **Add Tests**: Write unit tests for all new functions
3. **User Training**: Create video tutorials and documentation
4. **Phased Rollout**: Enable features one at a time with feature flags
5. **Monitor Performance**: Track load times and user feedback
6. **Iterate**: Refine based on real-world usage

---

**Need Help?**
- Documentation: See `IMPLEMENTATION_ROADMAP.md`
- Code Examples: Check `/examples` directory
- Support: Open GitHub issue or contact development team
