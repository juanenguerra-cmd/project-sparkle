import { loadDB, saveDB } from '@/lib/database';

export type WorkflowView = 'ip' | 'abt' | 'vax' | 'reports' | string;

export type WorkflowEventName =
  | 'workflow_modal_open'
  | 'workflow_resident_selected'
  | 'workflow_save_success'
  | 'workflow_report_quick_run';

export interface WorkflowMetric {
  id: string;
  eventName: WorkflowEventName;
  view: WorkflowView;
  residentId?: string;
  mrn?: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}

export interface WorkflowEfficiencySummary {
  medianClicksPerCompletedCase: {
    ip: number;
    abt: number;
    vax: number;
  };
  medianResidentSelectToSaveSeconds: {
    ip: number | null;
    abt: number | null;
    vax: number | null;
  };
}

const CASE_TYPES = ['ip', 'abt', 'vax'] as const;
type CaseType = (typeof CASE_TYPES)[number];

const genMetricId = (): string =>
  `wf_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

const toTimestampMs = (value: string): number => {
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : 0;
};

const median = (values: number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const normalizeCaseType = (value: unknown): CaseType | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return CASE_TYPES.includes(normalized as CaseType) ? (normalized as CaseType) : null;
};

export const buildWorkflowMetric = (
  input: Omit<WorkflowMetric, 'id' | 'timestamp'> & { timestamp?: string }
): WorkflowMetric => ({
  id: genMetricId(),
  eventName: input.eventName,
  view: input.view,
  residentId: input.residentId,
  mrn: input.mrn,
  timestamp: input.timestamp || new Date().toISOString(),
  metadata: input.metadata,
});

export const persistWorkflowMetric = (
  db: { workflow_metrics?: WorkflowMetric[] },
  metric: WorkflowMetric,
  maxEntries = 5000
): void => {
  const existing = Array.isArray(db.workflow_metrics) ? db.workflow_metrics : [];
  db.workflow_metrics = [metric, ...existing].slice(0, maxEntries);
};

export const recordWorkflowMetric = (
  input: Omit<WorkflowMetric, 'id' | 'timestamp'> & { timestamp?: string }
): WorkflowMetric => {
  const metric = buildWorkflowMetric(input);
  const db = loadDB();
  persistWorkflowMetric(db, metric);
  saveDB(db);
  return metric;
};

export const computeWorkflowEfficiency = (metrics: WorkflowMetric[]): WorkflowEfficiencySummary => {
  const sorted = [...metrics].sort((a, b) => toTimestampMs(a.timestamp) - toTimestampMs(b.timestamp));

  const clickSamples: Record<CaseType, number[]> = { ip: [], abt: [], vax: [] };
  const durationSamples: Record<CaseType, number[]> = { ip: [], abt: [], vax: [] };
  const openCounters: Record<CaseType, number> = { ip: 0, abt: 0, vax: 0 };
  const lastSelectionAt: Record<CaseType, number | null> = { ip: null, abt: null, vax: null };

  sorted.forEach((event) => {
    const caseType = normalizeCaseType(event.metadata?.caseType);
    if (!caseType) return;

    if (event.eventName === 'workflow_modal_open') {
      openCounters[caseType] = 1;
      return;
    }

    if (event.eventName === 'workflow_resident_selected') {
      openCounters[caseType] = Math.max(1, openCounters[caseType]) + 1;
      lastSelectionAt[caseType] = toTimestampMs(event.timestamp);
      return;
    }

    if (event.eventName === 'workflow_save_success') {
      const clicks = Math.max(1, openCounters[caseType]) + 1;
      clickSamples[caseType].push(clicks);
      const selectedAt = lastSelectionAt[caseType];
      const savedAt = toTimestampMs(event.timestamp);
      if (selectedAt && savedAt >= selectedAt) {
        durationSamples[caseType].push((savedAt - selectedAt) / 1000);
      }
      openCounters[caseType] = 0;
      lastSelectionAt[caseType] = null;
    }
  });

  return {
    medianClicksPerCompletedCase: {
      ip: median(clickSamples.ip) ?? 0,
      abt: median(clickSamples.abt) ?? 0,
      vax: median(clickSamples.vax) ?? 0,
    },
    medianResidentSelectToSaveSeconds: {
      ip: median(durationSamples.ip),
      abt: median(durationSamples.abt),
      vax: median(durationSamples.vax),
    },
  };
};

export const computeWorkflowEfficiencyFromDB = (): WorkflowEfficiencySummary => {
  const db = loadDB();
  const metrics = Array.isArray(db.workflow_metrics) ? db.workflow_metrics : [];
  return computeWorkflowEfficiency(metrics);
};
