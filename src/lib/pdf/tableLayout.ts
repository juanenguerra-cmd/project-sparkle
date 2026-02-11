export interface ColumnConfig {
  key: string;
  minWidth: number;
  maxWidth?: number;
  priority: number;
  alignment: 'left' | 'center' | 'right';
  wrapBehavior: 'nowrap' | 'normal' | 'break-all';
}

export const COLUMN_CONFIGS: Record<string, ColumnConfig[]> = {
  ABT_WORKLIST: [
    { key: 'room', minWidth: 40, maxWidth: 50, priority: 3, alignment: 'left', wrapBehavior: 'nowrap' },
    { key: 'resident', minWidth: 140, maxWidth: 180, priority: 1, alignment: 'left', wrapBehavior: 'normal' },
    { key: 'mrn', minWidth: 70, maxWidth: 80, priority: 4, alignment: 'left', wrapBehavior: 'nowrap' },
    { key: 'medication', minWidth: 100, maxWidth: 140, priority: 2, alignment: 'left', wrapBehavior: 'normal' },
    { key: 'dose', minWidth: 60, maxWidth: 80, priority: 3, alignment: 'left', wrapBehavior: 'nowrap' },
    { key: 'frequency', minWidth: 70, maxWidth: 90, priority: 3, alignment: 'left', wrapBehavior: 'normal' },
    { key: 'route', minWidth: 50, maxWidth: 70, priority: 4, alignment: 'left', wrapBehavior: 'nowrap' },
    { key: 'indication', minWidth: 100, maxWidth: 150, priority: 2, alignment: 'left', wrapBehavior: 'normal' },
    { key: 'start', minWidth: 65, maxWidth: 75, priority: 3, alignment: 'left', wrapBehavior: 'nowrap' },
    { key: 'end', minWidth: 65, maxWidth: 75, priority: 3, alignment: 'left', wrapBehavior: 'nowrap' },
    { key: 'notes', minWidth: 80, maxWidth: 120, priority: 2, alignment: 'left', wrapBehavior: 'normal' },
  ],
  SURVEYOR_PACKET: [
    { key: 'name', minWidth: 160, maxWidth: 220, priority: 1, alignment: 'left', wrapBehavior: 'normal' },
    { key: 'room', minWidth: 50, maxWidth: 65, priority: 3, alignment: 'left', wrapBehavior: 'nowrap' },
    { key: 'unit', minWidth: 60, maxWidth: 80, priority: 3, alignment: 'left', wrapBehavior: 'nowrap' },
    { key: 'abt', minWidth: 140, maxWidth: 200, priority: 2, alignment: 'left', wrapBehavior: 'normal' },
    { key: 'ip', minWidth: 140, maxWidth: 200, priority: 2, alignment: 'left', wrapBehavior: 'normal' },
  ],
};

export const calculateColumnWidths = (columns: ColumnConfig[], availableWidth: number): number[] => {
  const totalMin = columns.reduce((sum, col) => sum + col.minWidth, 0);
  if (totalMin >= availableWidth) {
    return columns.map((col) => col.minWidth);
  }

  const widths = columns.map((col) => col.minWidth);
  let remainingSpace = availableWidth - totalMin;
  const maxPriority = Math.max(...columns.map((c) => c.priority));

  for (let priority = 1; priority <= maxPriority && remainingSpace > 0; priority += 1) {
    const indices = columns
      .map((column, idx) => ({ column, idx }))
      .filter(({ column, idx }) => column.priority === priority && (!column.maxWidth || widths[idx] < column.maxWidth));

    if (indices.length === 0) continue;

    const share = remainingSpace / indices.length;
    indices.forEach(({ column, idx }) => {
      const growthCap = column.maxWidth ? column.maxWidth - widths[idx] : share;
      const growth = Math.max(0, Math.min(share, growthCap));
      widths[idx] += growth;
      remainingSpace -= growth;
    });
  }

  return widths;
};

export const detectColumnConfig = (reportTitle: string): ColumnConfig[] | null => {
  const normalizedTitle = reportTitle.toUpperCase();
  if (normalizedTitle.includes('ABT') || normalizedTitle.includes('ANTIBIOTIC')) return COLUMN_CONFIGS.ABT_WORKLIST;
  if (normalizedTitle.includes('SURVEYOR') || normalizedTitle.includes('SURVEY')) return COLUMN_CONFIGS.SURVEYOR_PACKET;
  return null;
};
