import { describe, expect, it } from 'vitest';
import {
  buildWorkflowMetric,
  computeWorkflowEfficiency,
  persistWorkflowMetric,
} from '@/lib/analytics/workflowMetrics';
import { migrateWorkflowMetrics } from '@/lib/migrations';

describe('workflow metrics persistence', () => {
  it('persists workflow metrics with newest-first order and retention cap', () => {
    const db: { workflow_metrics?: ReturnType<typeof buildWorkflowMetric>[] } = {
      workflow_metrics: [
        buildWorkflowMetric({ eventName: 'workflow_modal_open', view: 'ip', metadata: { caseType: 'ip' }, timestamp: '2026-01-01T00:00:01.000Z' }),
      ],
    };

    const next = buildWorkflowMetric({
      eventName: 'workflow_resident_selected',
      view: 'ip',
      metadata: { caseType: 'ip' },
      timestamp: '2026-01-01T00:00:02.000Z',
    });

    persistWorkflowMetric(db, next, 1);

    expect(db.workflow_metrics).toHaveLength(1);
    expect(db.workflow_metrics?.[0].eventName).toBe('workflow_resident_selected');
  });

  it('migrates legacy dbs to include workflow metrics store', () => {
    const legacy: any = {
      census: { residentsByMrn: {}, meta: { imported_at: null } },
      records: { abx: [], ip_cases: [], vax: [], notes: [], line_listings: [], outbreaks: [], contacts: [] },
      audit_log: [],
      settings: {},
      meta: { schemaVersion: 2 },
    };

    const migrated = migrateWorkflowMetrics(legacy);
    expect(migrated.migrated).toBe(true);
    expect(Array.isArray((migrated.db as any).workflow_metrics)).toBe(true);
    expect((migrated.db as any).meta?.schemaVersion).toBeGreaterThanOrEqual(3);
  });
});

describe('workflow metrics calculations', () => {
  it('computes median clicks and resident-select to save duration per case type', () => {
    const metrics = [
      buildWorkflowMetric({ eventName: 'workflow_modal_open', view: 'ip', metadata: { caseType: 'ip' }, timestamp: '2026-01-01T00:00:00.000Z' }),
      buildWorkflowMetric({ eventName: 'workflow_resident_selected', view: 'ip', metadata: { caseType: 'ip' }, timestamp: '2026-01-01T00:00:10.000Z' }),
      buildWorkflowMetric({ eventName: 'workflow_save_success', view: 'ip', metadata: { caseType: 'ip' }, timestamp: '2026-01-01T00:00:40.000Z' }),

      buildWorkflowMetric({ eventName: 'workflow_modal_open', view: 'abt', metadata: { caseType: 'abt' }, timestamp: '2026-01-01T01:00:00.000Z' }),
      buildWorkflowMetric({ eventName: 'workflow_resident_selected', view: 'abt', metadata: { caseType: 'abt' }, timestamp: '2026-01-01T01:00:20.000Z' }),
      buildWorkflowMetric({ eventName: 'workflow_save_success', view: 'abt', metadata: { caseType: 'abt' }, timestamp: '2026-01-01T01:01:20.000Z' }),

      buildWorkflowMetric({ eventName: 'workflow_modal_open', view: 'vax', metadata: { caseType: 'vax' }, timestamp: '2026-01-01T02:00:00.000Z' }),
      buildWorkflowMetric({ eventName: 'workflow_resident_selected', view: 'vax', metadata: { caseType: 'vax' }, timestamp: '2026-01-01T02:00:10.000Z' }),
      buildWorkflowMetric({ eventName: 'workflow_save_success', view: 'vax', metadata: { caseType: 'vax' }, timestamp: '2026-01-01T02:00:30.000Z' }),
    ];

    const summary = computeWorkflowEfficiency(metrics);

    expect(summary.medianClicksPerCompletedCase.ip).toBe(3);
    expect(summary.medianClicksPerCompletedCase.abt).toBe(3);
    expect(summary.medianClicksPerCompletedCase.vax).toBe(3);

    expect(summary.medianResidentSelectToSaveSeconds.ip).toBe(30);
    expect(summary.medianResidentSelectToSaveSeconds.abt).toBe(60);
    expect(summary.medianResidentSelectToSaveSeconds.vax).toBe(20);
  });
});
