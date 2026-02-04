// Default database structure and settings
// Shared between all storage adapters

import type { AppSettings } from '../types';

export interface ICNDatabaseShape {
  census: {
    residentsByMrn: Record<string, any>;
    meta: {
      imported_at: string | null;
    };
  };
  records: {
    abx: any[];
    ip_cases: any[];
    vax: any[];
    notes: any[];
    line_listings: any[];
    outbreaks: any[];
    contacts: any[];
  };
  audit_log: any[];
  settings: AppSettings & {
    last_import_at?: string;
    census_exclude_names?: string[];
    auto_close_on_census_drop?: boolean;
    auto_close_grace_days?: number;
  };
  cache?: Record<string, unknown>;
}

export const defaultSettings: AppSettings = {
  facilityName: 'Healthcare Facility',
  abtReviewCadence: 72,
  autoCloseCensus: true,
  autoCloseGraceDays: 2,
  ipRules: {
    ebpReviewDays: 7,
    isolationReviewDays: 3,
  },
  vaxRules: {
    FLU: { windowStartMmdd: '08-01', windowEndMmdd: '03-31' },
    COVID: { intervalDays: 180 },
    PNA: { intervalDays: 365 * 5 },
  },
  oneDriveBackup: {
    enabled: false,
    folderPath: '',
  },
};

export const defaultDatabase = (): ICNDatabaseShape => ({
  census: {
    residentsByMrn: {},
    meta: { imported_at: null }
  },
  records: {
    abx: [],
    ip_cases: [],
    vax: [],
    notes: [],
    line_listings: [],
    outbreaks: [],
    contacts: []
  },
  audit_log: [],
  settings: { ...defaultSettings }
});
