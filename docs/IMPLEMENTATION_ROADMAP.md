# Project Sparkle - Implementation Roadmap

## Overview
This document outlines the implementation plan for critical system improvements identified in the February 2026 security and functionality audit.

## ✅ Completed Implementations

### 1. Zod Validation Schemas ✓
**File**: `src/lib/validation.ts`

**Features**:
- Comprehensive validation for all data types (Resident, ABT, IP, Vax, Note, Outbreak)
- Override capability for edge cases
- Duplicate MRN detection
- Census import validation with gap detection
- Date range validation (start < end)
- Required field enforcement

**Usage**:
```typescript
import { validateWithOverride, ResidentSchema, checkDuplicateMRN } from './lib/validation';

const result = validateWithOverride(ResidentSchema, residentData);
if (!result.success) {
  if (result.canOverride) {
    // Show warning, allow user to override
  } else {
    // Block save, show errors
  }
}
```

### 2. Automatic Backup System ✓
**File**: `src/lib/backup.ts`

**Features**:
- Daily backup prompts
- JSON export to Downloads folder
- Local backup storage (30-day retention)
- Backup metadata tracking
- Import/restore functionality
- Auto-cleanup of old backups

**Integration**:
```typescript
import { initializeAutoBackup, triggerManualBackup } from './lib/backup';

// On app initialization
initializeAutoBackup(database);

// Manual backup button
triggerManualBackup(database);
```

### 3. Dashboard Alert System ✓
**File**: `src/lib/alerts.ts`

**Features**:
- Overdue ABT review alerts (7+ days)
- Overdue IP case review alerts
- Vaccination due/overdue tracking
- Outbreak threshold detection (3+ cases in 72hrs)
- Active outbreak monitoring
- Census data staleness warnings
- Backup status alerts

**Integration**:
```typescript
import { generateAllAlerts } from './lib/alerts';

const alerts = generateAllAlerts(database);
// Display in dashboard component
```

### 4. Global Search ✓
**File**: `src/lib/globalSearch.ts`

**Features**:
- Search across all entities (residents, ABT, IP, vax, notes, outbreaks)
- Weighted relevance scoring
- Field-level match tracking
- Quick filters by medication, resident, unit
- Configurable result limits

**Integration**:
```typescript
import { globalSearch } from './lib/globalSearch';

const results = globalSearch(database, 'vancomycin', {
  entities: ['abt'],
  limit: 20
});
```

## 🚧 Remaining Priority Implementations

### 5. Vaccination Series Tracking
**Priority**: HIGH
**Estimated Effort**: 3 days
**File**: `src/lib/vaccineSeriesTracking.ts`

**Requirements**:
```typescript
interface VaccineSeriesDefinition {
  vaccine: string;
  doses: number;
  intervalDays: number;
  windowDays?: number; // Flexibility window
  boosterIntervalMonths?: number;
}

// Definitions
const SERIES_DEFINITIONS: VaccineSeriesDefinition[] = [
  {
    vaccine: 'COVID-19',
    doses: 2,
    intervalDays: 21,
    windowDays: 7, // 21-28 days acceptable
    boosterIntervalMonths: 6
  },
  {
    vaccine: 'Shingrix',
    doses: 2,
    intervalDays: 60, // 2-6 months
    windowDays: 120
  }
];

// Auto-calculate next due date
function calculateNextDose(vaccine: string, lastDoseDate: string): string;

// Check series completion
function getSeriesStatus(residentVaxHistory: VaxRecord[]): SeriesStatus;
```

### 6. Quick Actions System
**Priority**: HIGH
**Estimated Effort**: 2 days
**File**: `src/components/QuickActions.tsx`

**Features**:
- Bulk ABT review (select multiple, mark as reviewed)
- Batch vaccination status update
- Quick isolation precaution toggle
- Multi-resident note entry
- Rapid outbreak case linking

**UI Design**:
```
┌─────────────────────────────────────┐
│ Quick Actions                    [×]│
├─────────────────────────────────────┤
│ ☑ Smith, John - Cipro Review      │
│ ☑ Doe, Jane - Vancomycin Review   │
│ ☐ Brown, Bob - Ceftriaxone Review │
├─────────────────────────────────────┤
│ Review Notes: ____________________ │
│                                     │
│ [Mark 2 Selected as Reviewed]      │
└─────────────────────────────────────┘
```

### 7. Outbreak Detection Algorithm
**Priority**: HIGH
**Estimated Effort**: 2 days
**File**: `src/lib/outbreakDetection.ts` (extends alerts.ts)

**Algorithm**:
```typescript
interface OutbreakThreshold {
  category: SymptomCategory;
  caseCount: number;
  timeWindowHours: number;
  unitClustering?: boolean;
}

const THRESHOLDS: OutbreakThreshold[] = [
  { category: 'respiratory', caseCount: 3, timeWindowHours: 72 },
  { category: 'gi', caseCount: 3, timeWindowHours: 48 },
  { category: 'skin', caseCount: 2, timeWindowHours: 72, unitClustering: true }
];

function detectOutbreaks(
  ipCases: IPCase[],
  residents: Record<string, Resident>
): OutbreakDetection[] {
  // 1. Group cases by category and time window
  // 2. Check unit clustering (>=2 cases same unit)
  // 3. Generate recommendations
  // 4. Auto-create "watch" status outbreaks
}
```

### 8. Scheduled Report Generation
**Priority**: MEDIUM
**Estimated Effort**: 4 days
**File**: `src/lib/scheduledReports.ts`

**Features**:
```typescript
interface ReportSchedule {
  id: string;
  reportType: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM
  recipients: string[];
  format: 'pdf' | 'xlsx' | 'json';
  autoExport: boolean;
  lastRun?: string;
}

// Uses Web Workers for background generation
function scheduleReport(config: ReportSchedule): void;

// Check and run due reports
function checkScheduledReports(): void;
```

**Integration with Service Workers**:
- Register service worker for background tasks
- Store scheduled reports in IndexedDB
- Notification API for completion alerts

### 9. Mobile Companion App
**Priority**: LOW (Future Phase)
**Estimated Effort**: 3-4 weeks
**Technology**: React Native or Progressive Web App

**MVP Features**:
- Barcode/QR scanning for resident lookup
- Quick symptom entry form
- Photo upload for wound documentation
- Offline mode with sync
- Push notifications for alerts

**Architecture**:
```
Mobile App (React Native)
    ↓
Local SQLite DB ← → Sync Service ← → Web App LocalStorage
    ↓
Encrypted Cloud Backup (optional)
```

### 10. AI-Assisted Infection Classification
**Priority**: LOW (Research Phase)
**Estimated Effort**: Unknown (R&D required)
**Technology**: TensorFlow.js or External API

**Concept**:
```typescript
interface SymptomInput {
  symptoms: string[];
  vitalSigns?: {
    temp?: number;
    hr?: number;
    rr?: number;
  };
  labResults?: string[];
  medicalHistory?: string[];
}

interface ClassificationResult {
  category: SymptomCategory;
  confidence: number;
  suggestedProtocol: 'EBP' | 'Isolation';
  reasoning: string[];
  recommendedTests: string[];
}

async function classifyInfection(input: SymptomInput): Promise<ClassificationResult>;
```

**Considerations**:
- HIPAA compliance for AI processing
- Training data acquisition
- Model accuracy validation
- Clinician override required
- Audit trail for AI suggestions

## 📋 Integration Checklist

### Phase 1: Core Features (Week 1-2)
- [x] Integrate Zod validation into all forms
- [x] Add override confirmation dialogs
- [x] Implement backup auto-trigger on app load
- [x] Create dashboard alerts widget
- [x] Add global search bar to navigation
- [ ] Test validation with edge cases
- [ ] Test backup restore functionality

### Phase 2: Enhanced Tracking (Week 3-4)
- [ ] Implement vaccine series logic
- [ ] Add auto due date calculation
- [ ] Create quick actions panel
- [ ] Enhance outbreak detection
- [ ] Add unit clustering analysis
- [ ] Create outbreak declaration workflow

### Phase 3: Automation (Week 5-6)
- [ ] Build scheduled report engine
- [ ] Implement service worker
- [ ] Add email/export automation
- [ ] Create report template library
- [ ] Test background job reliability

### Phase 4: Mobile & AI (Future)
- [ ] Research PWA vs Native
- [ ] Design mobile UI/UX
- [ ] Implement sync protocol
- [ ] Research AI classification models
- [ ] Pilot AI features with test data

## 🔧 Development Environment Setup

### Prerequisites
```bash
# Install dependencies
npm install

# Add new type definitions
npm install --save-dev @types/date-fns

# Run type checking
npx tsc --noEmit

# Run linter
npm run lint

# Run tests
npm test
```

### Testing Strategy

#### Unit Tests
```typescript
// validation.test.ts
import { validateWithOverride, ResidentSchema } from '../lib/validation';

describe('Validation', () => {
  it('should reject invalid MRN format', () => {
    const result = validateWithOverride(ResidentSchema, { mrn: '' });
    expect(result.success).toBe(false);
  });
  
  it('should detect duplicate MRNs', () => {
    // Test implementation
  });
});
```

#### Integration Tests
```typescript
// backup.test.ts
import { exportBackup, importBackup } from '../lib/backup';

describe('Backup System', () => {
  it('should export and import without data loss', async () => {
    // Test implementation
  });
});
```

#### E2E Tests (Playwright)
```typescript
// alert-workflow.spec.ts
test('should display ABT review alerts', async ({ page }) => {
  await page.goto('/dashboard');
  const alerts = page.locator('[data-testid="alert-item"]');
  await expect(alerts).toHaveCount(3);
});
```

## 📊 Success Metrics

### Data Quality
- **Target**: <1% validation errors override rate
- **Target**: 0 duplicate MRNs in production
- **Target**: <24hr gap in census data

### System Reliability
- **Target**: 95% backup completion rate
- **Target**: 100% alert delivery for critical items
- **Target**: <2s search response time

### User Efficiency
- **Target**: 50% reduction in ABT review time (quick actions)
- **Target**: 30% faster outbreak declaration (detection)
- **Target**: 80% reduction in manual report generation time

### Compliance
- **Target**: 100% F880 audit trail coverage
- **Target**: 100% F881 review enforcement
- **Target**: 100% F883/F887 vaccination tracking

## 🚀 Deployment Plan

### Staging Environment
1. Deploy to test environment
2. Load test data (100 residents, 500 records)
3. Run full test suite
4. User acceptance testing with IP nurse
5. Security audit

### Production Rollout
1. **Phase 1**: Validation only (read-only mode)
2. **Phase 2**: Enable backups and alerts
3. **Phase 3**: Enable search and quick actions
4. **Phase 4**: Enable outbreak detection
5. **Phase 5**: Enable scheduled reports

### Rollback Plan
Each feature has a feature flag:
```typescript
const FEATURE_FLAGS = {
  VALIDATION_ENABLED: true,
  BACKUP_ENABLED: true,
  ALERTS_ENABLED: true,
  SEARCH_ENABLED: true,
  QUICK_ACTIONS_ENABLED: false, // Not yet deployed
};
```

## 📞 Support & Training

### Training Materials
- [ ] Video: "Data Validation and Override"
- [ ] Video: "Backup and Restore"
- [ ] Video: "Using Dashboard Alerts"
- [ ] Video: "Global Search Tips"
- [ ] PDF: Quick Reference Guide

### Support Channels
- **Email**: support@projectsparkle.health
- **Documentation**: https://docs.projectsparkle.health
- **Issue Tracker**: GitHub Issues

---

**Last Updated**: February 12, 2026  
**Maintainer**: Project Sparkle Development Team  
**Status**: Phase 1 Complete, Phase 2 In Progress
