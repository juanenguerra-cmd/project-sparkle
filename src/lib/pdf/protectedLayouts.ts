export const PROTECTED_REPORTS = [
  'RESIDENTS ON PRECAUTIONS OR ISOLATION',
  'Daily Precaution List',
  'Active Precautions List',
  'PRECAUTION/ISOLATION LOG',
] as const;

export const isProtectedReport = (reportTitle: string): boolean => {
  const normalized = reportTitle.toUpperCase();
  return PROTECTED_REPORTS.some((protectedTitle) =>
    normalized.includes(protectedTitle.toUpperCase())
  );
};

export type ReportLayoutStrategy = 'protected' | 'universal';

export const getReportLayoutStrategy = (reportTitle: string): ReportLayoutStrategy => {
  return isProtectedReport(reportTitle) ? 'protected' : 'universal';
};
