import * as XLSX from 'xlsx';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const tryParseJson = (value: string): string | null => {
  if (!value) return null;
  try {
    JSON.parse(value);
    return value;
  } catch {
    return null;
  }
};

export const isSpreadsheetFile = (file: File): boolean => {
  const normalized = file.name.toLowerCase();
  return normalized.endsWith('.xlsx') || normalized.endsWith('.xls');
};

export const buildBackupSpreadsheetBlob = (jsonText: string): Blob => {
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const workbook = XLSX.utils.book_new();

  const metadataSheet = XLSX.utils.json_to_sheet([
    { field: 'exported_at', value: String(parsed.exported_at ?? '') },
    { field: 'version', value: String(parsed.version ?? '') },
  ]);

  const backupJsonSheet = XLSX.utils.json_to_sheet([{ payload: jsonText }]);

  XLSX.utils.book_append_sheet(workbook, metadataSheet, 'metadata');
  XLSX.utils.book_append_sheet(workbook, backupJsonSheet, 'backup_json');

  const workbookData = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([workbookData], { type: XLSX_MIME });
};

export const readBackupFileAsJson = async (file: File): Promise<string> => {
  if (!isSpreadsheetFile(file)) {
    return file.text();
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const backupSheet = workbook.Sheets.backup_json;
  if (backupSheet) {
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(backupSheet, { defval: '' });
    const payload = String(rows[0]?.payload ?? '');
    const parsedPayload = tryParseJson(payload);
    if (parsedPayload) {
      return parsedPayload;
    }
  }

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      for (const cell of row) {
        if (typeof cell !== 'string') continue;
        const parsedCell = tryParseJson(cell.trim());
        if (parsedCell) {
          return parsedCell;
        }
      }
    }
  }

  throw new Error('No valid backup payload found in spreadsheet.');
};
