// Dashboard Alert System
// Monitors various conditions and generates actionable alerts

import { addDays, differenceInDays, format, isAfter, isBefore, parseISO } from 'date-fns';
import type { ABTRecord, IPCase, VaxRecord, Outbreak, AppDatabase } from './types';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertCategory = 'abt' | 'ip' | 'vaccination' | 'outbreak' | 'census' | 'backup';

export interface Alert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  data?: Record<string, any>;
  createdAt: string;
}

// ABT Review Alerts
export function checkOverdueABTReviews(
  records: ABTRecord[],
  reviewCadenceDays: number = 7
): Alert[] {
  const alerts: Alert[] = [];
  const today = new Date();
  
  const activeRecords = records.filter(r => r.status === 'active');
  
  for (const record of activeRecords) {
    const nextReview = record.nextReviewDate;
    if (!nextReview) continue;
    
    const reviewDate = parseISO(nextReview);
    const daysOverdue = differenceInDays(today, reviewDate);
    
    if (daysOverdue > 0) {
      alerts.push({
        id: `abt_overdue_${record.id}`,
        category: 'abt',
        severity: daysOverdue > 7 ? 'critical' : 'warning',
        title: 'ABT Review Overdue',
        message: `${record.residentName || record.name} - ${record.medication || record.med_name} review is ${daysOverdue} days overdue (due: ${format(reviewDate, 'MMM d')})`,
        actionUrl: `/abt?highlight=${record.id}`,
        actionLabel: 'Review Now',
        data: {
          recordId: record.id,
          mrn: record.mrn,
          medication: record.medication || record.med_name,
          daysOverdue,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }
  
  return alerts;
}

// IP Case Review Alerts
export function checkIPCaseReviews(cases: IPCase[]): Alert[] {
  const alerts: Alert[] = [];
  const today = new Date();
  
  const activeCases = cases.filter(c => c.status === 'Active');
  
  for (const ipCase of activeCases) {
    const nextReview = ipCase.nextReviewDate || ipCase.next_review_date;
    if (!nextReview) continue;
    
    const reviewDate = parseISO(nextReview);
    const daysOverdue = differenceInDays(today, reviewDate);
    
    if (daysOverdue > 0) {
      alerts.push({
        id: `ip_overdue_${ipCase.id}`,
        category: 'ip',
        severity: daysOverdue > 3 ? 'critical' : 'warning',
        title: 'IP Case Review Overdue',
        message: `${ipCase.residentName || ipCase.name} - ${ipCase.infectionType || ipCase.infection_type} review is ${daysOverdue} days overdue`,
        actionUrl: `/ip?highlight=${ipCase.id}`,
        actionLabel: 'Review Now',
        data: {
          caseId: ipCase.id,
          mrn: ipCase.mrn,
          daysOverdue,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }
  
  return alerts;
}

// Vaccination Due Date Alerts
export function checkVaccinationsDue(records: VaxRecord[]): Alert[] {
  const alerts: Alert[] = [];
  const today = new Date();
  const warningWindow = addDays(today, 14); // 2 weeks warning
  
  const dueRecords = records.filter(r => r.status === 'due' || r.status === 'overdue');
  
  for (const record of dueRecords) {
    const dueDate = record.dueDate || record.due_date;
    if (!dueDate) continue;
    
    const due = parseISO(dueDate);
    const isOverdue = isBefore(due, today);
    const isDueSoon = !isOverdue && isBefore(due, warningWindow);
    
    if (isOverdue) {
      const daysOverdue = differenceInDays(today, due);
      alerts.push({
        id: `vax_overdue_${record.id}`,
        category: 'vaccination',
        severity: 'critical',
        title: 'Vaccination Overdue',
        message: `${record.residentName || record.name} - ${record.vaccine} is ${daysOverdue} days overdue`,
        actionUrl: `/vax?highlight=${record.id}`,
        actionLabel: 'Administer',
        data: {
          recordId: record.id,
          mrn: record.mrn,
          vaccine: record.vaccine,
          daysOverdue,
        },
        createdAt: new Date().toISOString(),
      });
    } else if (isDueSoon) {
      const daysUntilDue = differenceInDays(due, today);
      alerts.push({
        id: `vax_due_${record.id}`,
        category: 'vaccination',
        severity: 'info',
        title: 'Vaccination Due Soon',
        message: `${record.residentName || record.name} - ${record.vaccine} due in ${daysUntilDue} days`,
        actionUrl: `/vax?highlight=${record.id}`,
        actionLabel: 'Schedule',
        data: {
          recordId: record.id,
          mrn: record.mrn,
          vaccine: record.vaccine,
          daysUntilDue,
        },
        createdAt: new Date().toISOString(),
      });
    }
  }
  
  return alerts;
}

// Outbreak Detection Alerts
export function checkOutbreakThresholds(
  db: AppDatabase,
  thresholdHours: number = 72
): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();
  const thresholdDate = new Date(now.getTime() - thresholdHours * 60 * 60 * 1000);
  
  // Get recent IP cases
  const recentCases = (db.records?.ip_cases || []).filter(c => {
    const onset = c.onsetDate || c.onset_date;
    if (!onset) return false;
    const onsetDate = parseISO(onset);
    return isAfter(onsetDate, thresholdDate);
  });
  
  // Group by syndrome category
  const byCategory: Record<string, IPCase[]> = {};
  for (const ipCase of recentCases) {
    const category = ipCase.syndromeCategory || 'other';
    if (!byCategory[category]) byCategory[category] = [];
    byCategory[category].push(ipCase);
  }
  
  // Check thresholds (3+ cases in 72 hours)
  for (const [category, cases] of Object.entries(byCategory)) {
    if (cases.length >= 3) {
      // Check if outbreak already declared
      const existingOutbreak = (db.records?.outbreaks || []).find(
        o => o.type === category && (o.status === 'watch' || o.status === 'active')
      );
      
      if (!existingOutbreak) {
        alerts.push({
          id: `outbreak_threshold_${category}`,
          category: 'outbreak',
          severity: 'critical',
          title: 'Potential Outbreak Detected',
          message: `${cases.length} ${category} cases detected in ${thresholdHours} hours. Consider declaring outbreak watch.`,
          actionUrl: '/outbreak',
          actionLabel: 'Declare Outbreak',
          data: {
            category,
            caseCount: cases.length,
            affectedResidents: cases.map(c => c.mrn),
          },
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
  
  return alerts;
}

// Active Outbreak Alerts
export function checkActiveOutbreaks(outbreaks: Outbreak[]): Alert[] {
  const alerts: Alert[] = [];
  
  const activeOutbreaks = outbreaks.filter(o => o.status === 'active');
  
  for (const outbreak of activeOutbreaks) {
    const daysActive = differenceInDays(new Date(), parseISO(outbreak.startDate));
    
    alerts.push({
      id: `outbreak_active_${outbreak.id}`,
      category: 'outbreak',
      severity: 'warning',
      title: 'Active Outbreak',
      message: `${outbreak.name} - ${outbreak.totalCases} cases, ${daysActive} days active`,
      actionUrl: `/outbreak?id=${outbreak.id}`,
      actionLabel: 'View Details',
      data: {
        outbreakId: outbreak.id,
        caseCount: outbreak.totalCases,
        daysActive,
      },
      createdAt: new Date().toISOString(),
    });
  }
  
  return alerts;
}

// Census Data Staleness Alert
export function checkCensusDataStaleness(lastImportDate?: string): Alert[] {
  if (!lastImportDate) {
    return [{
      id: 'census_no_data',
      category: 'census',
      severity: 'critical',
      title: 'No Census Data',
      message: 'Census has never been imported. Please import census data.',
      actionUrl: '/census',
      actionLabel: 'Import Census',
      createdAt: new Date().toISOString(),
    }];
  }
  
  const lastImport = parseISO(lastImportDate);
  const daysOld = differenceInDays(new Date(), lastImport);
  
  if (daysOld > 7) {
    return [{
      id: 'census_stale',
      category: 'census',
      severity: 'warning',
      title: 'Census Data Outdated',
      message: `Census last imported ${daysOld} days ago. Consider refreshing.`,
      actionUrl: '/census',
      actionLabel: 'Import Census',
      data: { daysOld },
      createdAt: new Date().toISOString(),
    }];
  }
  
  return [];
}

// Backup Alert
export function checkBackupStatus(lastBackupDate?: string): Alert[] {
  if (!lastBackupDate) {
    return [{
      id: 'backup_never',
      category: 'backup',
      severity: 'critical',
      title: 'No Backup Created',
      message: 'No backup has been created. Your data is at risk.',
      actionUrl: '/settings',
      actionLabel: 'Create Backup',
      createdAt: new Date().toISOString(),
    }];
  }
  
  const lastBackup = parseISO(lastBackupDate);
  const daysOld = differenceInDays(new Date(), lastBackup);
  
  if (daysOld > 7) {
    return [{
      id: 'backup_overdue',
      category: 'backup',
      severity: 'warning',
      title: 'Backup Overdue',
      message: `Last backup was ${daysOld} days ago. Create a backup to protect your data.`,
      actionUrl: '/settings',
      actionLabel: 'Create Backup',
      data: { daysOld },
      createdAt: new Date().toISOString(),
    }];
  }
  
  return [];
}

// Generate all alerts
export function generateAllAlerts(db: AppDatabase): Alert[] {
  const alerts: Alert[] = [];
  
  // ABT alerts
  alerts.push(...checkOverdueABTReviews(
    db.records?.abx || [],
    db.settings?.abtReviewCadence
  ));
  
  // IP case alerts
  alerts.push(...checkIPCaseReviews(db.records?.ip_cases || []));
  
  // Vaccination alerts
  alerts.push(...checkVaccinationsDue(db.records?.vax || []));
  
  // Outbreak alerts
  alerts.push(...checkOutbreakThresholds(db));
  alerts.push(...checkActiveOutbreaks(db.records?.outbreaks || []));
  
  // Census alerts
  alerts.push(...checkCensusDataStaleness(db.census?.meta?.imported_at || undefined));
  
  // Backup alerts (requires external backup status)
  // alerts.push(...checkBackupStatus(backupStatus));
  
  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// Get alerts by category
export function getAlertsByCategory(alerts: Alert[], category: AlertCategory): Alert[] {
  return alerts.filter(a => a.category === category);
}

// Get alert count by severity
export function getAlertCountBySeverity(alerts: Alert[]): Record<AlertSeverity, number> {
  return alerts.reduce((acc, alert) => {
    acc[alert.severity] = (acc[alert.severity] || 0) + 1;
    return acc;
  }, {} as Record<AlertSeverity, number>);
}
