export const convertToCSV = (records: Array<Record<string, unknown>>, columns: string[]): string => {
  if (records.length === 0) {
    return '';
  }

  const header = columns.join(',');
  const rows = records.map((record) => columns.map((column) => escapeCSV(record[column])).join(','));
  return [header, ...rows].join('\n');
};

export const collectColumns = (
  records: Array<Record<string, unknown>>,
  preferredColumns: string[] = [],
): string[] => {
  const ordered = new Set<string>(preferredColumns);

  records.forEach((record) => {
    Object.keys(record).forEach((key) => {
      if (!ordered.has(key)) {
        ordered.add(key);
      }
    });
  });

  return Array.from(ordered);
};

const escapeCSV = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  const text = Array.isArray(value) ? value.join('; ') : String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const downloadCSV = (csvContent: string, filename: string): void => {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const parseCSV = (text: string): Array<Record<string, string>> => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) {
    return [];
  }

  const headers = parseCSVLine(lines[0]);

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });

    return row;
  });
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
};
