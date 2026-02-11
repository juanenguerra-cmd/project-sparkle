export interface StandardLayoutConfig {
  pageSize: 'letter' | 'legal' | 'a4';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  fonts: {
    facilityName: number;
    reportTitle: number;
    sectionTitle: number;
    tableHeader: number;
    tableBody: number;
    filters: number;
    footer: number;
    disclaimer: number;
  };
  headerSpacing: number;
  tableTopMargin: number;
  sectionSpacing: number;
  footerTopMargin: number;
  tableBorders: {
    width: number;
    color: [number, number, number];
  };
  tableHeaderBg: [number, number, number];
  tableHeaderText: [number, number, number];
  cellPadding: {
    horizontal: number;
    vertical: number;
  };
}

const SOFT_BORDER: [number, number, number] = [180, 180, 180];
const LIGHT_HEADER_BG: [number, number, number] = [240, 240, 240];
const DARK_TEXT: [number, number, number] = [20, 20, 20];

export const LAYOUT_PRESETS: Record<string, StandardLayoutConfig> = {
  DAILY_OPERATIONAL: {
    pageSize: 'letter',
    orientation: 'portrait',
    margins: { top: 40, right: 32, bottom: 40, left: 32 },
    fonts: { facilityName: 14, reportTitle: 12, sectionTitle: 11, tableHeader: 10, tableBody: 9, filters: 10, footer: 9, disclaimer: 8 },
    headerSpacing: 18,
    tableTopMargin: 22,
    sectionSpacing: 16,
    footerTopMargin: 24,
    tableBorders: { width: 0.5, color: SOFT_BORDER },
    tableHeaderBg: LIGHT_HEADER_BG,
    tableHeaderText: DARK_TEXT,
    cellPadding: { horizontal: 6, vertical: 4 },
  },
  REGULATORY: {
    pageSize: 'letter',
    orientation: 'portrait',
    margins: { top: 50, right: 40, bottom: 50, left: 40 },
    fonts: { facilityName: 16, reportTitle: 14, sectionTitle: 12, tableHeader: 11, tableBody: 10, filters: 11, footer: 10, disclaimer: 9 },
    headerSpacing: 20,
    tableTopMargin: 28,
    sectionSpacing: 20,
    footerTopMargin: 32,
    tableBorders: { width: 1, color: SOFT_BORDER },
    tableHeaderBg: LIGHT_HEADER_BG,
    tableHeaderText: DARK_TEXT,
    cellPadding: { horizontal: 8, vertical: 5 },
  },
  LANDSCAPE_DATA: {
    pageSize: 'letter',
    orientation: 'landscape',
    margins: { top: 36, right: 32, bottom: 36, left: 32 },
    fonts: { facilityName: 14, reportTitle: 12, sectionTitle: 11, tableHeader: 9, tableBody: 8, filters: 10, footer: 9, disclaimer: 8 },
    headerSpacing: 16,
    tableTopMargin: 20,
    sectionSpacing: 14,
    footerTopMargin: 20,
    tableBorders: { width: 0.5, color: SOFT_BORDER },
    tableHeaderBg: LIGHT_HEADER_BG,
    tableHeaderText: DARK_TEXT,
    cellPadding: { horizontal: 5, vertical: 3 },
  },
  COMPACT_LIST: {
    pageSize: 'letter',
    orientation: 'portrait',
    margins: { top: 32, right: 28, bottom: 32, left: 28 },
    fonts: { facilityName: 12, reportTitle: 11, sectionTitle: 10, tableHeader: 9, tableBody: 8, filters: 9, footer: 8, disclaimer: 7 },
    headerSpacing: 14,
    tableTopMargin: 18,
    sectionSpacing: 12,
    footerTopMargin: 18,
    tableBorders: { width: 0.5, color: SOFT_BORDER },
    tableHeaderBg: LIGHT_HEADER_BG,
    tableHeaderText: DARK_TEXT,
    cellPadding: { horizontal: 4, vertical: 2 },
  },
};

export const REPORT_LAYOUT_MAP: Record<string, keyof typeof LAYOUT_PRESETS> = {
  'IP Daily Morning Report': 'DAILY_OPERATIONAL',
  'Daily IP Worklist': 'DAILY_OPERATIONAL',
  'ABT Review Worklist': 'DAILY_OPERATIONAL',
  'Active Precautions List': 'DAILY_OPERATIONAL',
  'Vaccination Due List': 'DAILY_OPERATIONAL',
  'Survey Readiness Packet': 'REGULATORY',
  'Surveyor Census Packet': 'REGULATORY',
  'Compliance Crosswalk': 'REGULATORY',
  'QAPI Summary': 'REGULATORY',
  'Monthly ABT Report': 'LANDSCAPE_DATA',
  'Standard of Care Report': 'LANDSCAPE_DATA',
  'Antibiotic Duration Analysis': 'LANDSCAPE_DATA',
  'Exposure Tracking Log': 'COMPACT_LIST',
  'Outbreak Summary': 'COMPACT_LIST',
};

export const getLayoutForReport = (reportTitle: string): StandardLayoutConfig => {
  const exact = REPORT_LAYOUT_MAP[reportTitle];
  if (exact) return LAYOUT_PRESETS[exact];

  const normalizedTitle = reportTitle.toUpperCase();
  const detectedEntry = Object.entries(REPORT_LAYOUT_MAP).find(([title]) =>
    normalizedTitle.includes(title.toUpperCase())
  );

  return detectedEntry ? LAYOUT_PRESETS[detectedEntry[1]] : LAYOUT_PRESETS.DAILY_OPERATIONAL;
};
