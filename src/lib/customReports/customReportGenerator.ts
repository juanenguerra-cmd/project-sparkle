import type {
  CustomReportTemplate,
  ColumnDefinition,
  ColumnTransform,
  DataSource,
  SortConfig,
} from '@/lib/types';
import type { ICNDatabase } from '@/lib/database';
import type { ReportData } from '@/lib/reportGenerators';
import { getAllStaff } from '@/lib/stores/staffStore';
import { getStaffVaccinationRows } from '@/lib/reports/staffVaccinationRows';

export const generateCustomReport = (
  template: CustomReportTemplate,
  db: ICNDatabase
): ReportData => {
  const rawData = fetchDataFromSource(template.dataSource, db);
  const sortedColumns = [...template.selectedColumns].sort((a, b) => a.position - b.position);

  const transformed = rawData.map((record) => transformRecord(record, sortedColumns));

  if (template.sorting) {
    transformed.sort((a, b) => compareRecords(a, b, template.sorting as SortConfig));
  }

  return {
    title: template.name,
    subtitle: template.description,
    generatedAt: new Date().toISOString(),
    filters: Object.fromEntries(Object.entries(template.filters || {}).map(([k, v]) => [k, String(v ?? '')])),
    headers: sortedColumns.map((col) => col.displayName),
    rows: transformed.map((record) => sortedColumns.map((col) => formatCellValue(record[col.fieldPath], col))),
  };
};

const fetchDataFromSource = (source: DataSource, db: ICNDatabase): Record<string, unknown>[] => {
  switch (source) {
    case 'census':
      return Object.values(db.census.residentsByMrn);
    case 'abt':
      return db.records.abx;
    case 'ip_cases':
      return db.records.ip_cases;
    case 'vaccinations':
      return db.records.vax;
    case 'notes':
      return db.records.notes;
    case 'line_listings':
      return db.records.line_listings;
    case 'outbreaks':
      return db.records.outbreaks;
    case 'contacts':
      return db.records.contacts;
    case 'staff':
      return getAllStaff() as unknown as Record<string, unknown>[];
    case 'staffVaccination':
      return getStaffVaccinationRows({}) as unknown as Record<string, unknown>[];
    default:
      return [];
  }
};

const transformRecord = (record: Record<string, unknown>, columns: ColumnDefinition[]): Record<string, unknown> => {
  const transformed: Record<string, unknown> = {};
  columns.forEach((col) => {
    let value = record[col.fieldPath];
    if (col.transform) {
      value = applyTransform(value, col.transform, record);
    }
    transformed[col.fieldPath] = value;
  });
  return transformed;
};

const applyTransform = (value: unknown, transform: ColumnTransform, fullRecord: Record<string, unknown>): unknown => {
  switch (transform) {
    case 'uppercase':
      return String(value ?? '').toUpperCase();
    case 'lowercase':
      return String(value ?? '').toLowerCase();
    case 'titlecase':
      return String(value ?? '').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
    case 'calculate_duration': {
      const start = String(fullRecord.startDate || fullRecord.onsetDate || '');
      const end = String(fullRecord.endDate || fullRecord.resolutionDate || new Date().toISOString());
      if (!start) return 'N/A';
      const days = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24));
      return days + 1;
    }
    case 'calculate_age': {
      const dob = String(fullRecord.dob || '');
      if (!dob) return 'N/A';
      return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
    }

    case 'infer_class': {
      const med = String(fullRecord.medication || fullRecord.med_name || value || '').toLowerCase();
      if (!med) return '';
      if (/(cillin|penem|cef|ceph|amoxicillin|piperacillin)/.test(med)) return 'Beta-lactam';
      if (/(floxacin)/.test(med)) return 'Fluoroquinolone';
      if (/(mycin|micin)/.test(med)) return 'Macrolide/Aminoglycoside';
      if (/(cycline)/.test(med)) return 'Tetracycline';
      if (/(azole)/.test(med)) return 'Nitroimidazole';
      return 'Other';
    }
    default:
      return value;
  }
};

const formatCellValue = (value: unknown, column: ColumnDefinition): string => {
  if (value === null || value === undefined) return '';
  if (!column.format) return String(value);

  switch (column.format.type) {
    case 'date':
      return new Date(String(value)).toLocaleDateString('en-US');
    case 'currency':
      return `$${Number(value).toFixed(2)}`;
    case 'percentage':
      return `${Number(value).toFixed(1)}%`;
    default:
      return String(value);
  }
};

const compareRecords = (a: Record<string, unknown>, b: Record<string, unknown>, sorting: SortConfig): number => {
  const aVal = a[sorting.field];
  const bVal = b[sorting.field];
  if (aVal === bVal) return 0;
  if (aVal === undefined || aVal === null) return 1;
  if (bVal === undefined || bVal === null) return -1;
  return (aVal < bVal ? -1 : 1) * (sorting.direction === 'asc' ? 1 : -1);
};
