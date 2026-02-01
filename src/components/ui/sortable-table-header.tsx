import { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableTableHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  currentSortDirection: SortDirection;
  onSort: (key: string) => void;
  className?: string;
}

export const SortableTableHeader = ({
  label,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  className
}: SortableTableHeaderProps) => {
  const isActive = currentSortKey === sortKey;

  return (
    <th
      className={cn(
        "cursor-pointer select-none hover:bg-muted/50 transition-colors",
        className
      )}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {isActive ? (
            currentSortDirection === 'asc' ? (
              <ArrowUp className="h-4 w-4" />
            ) : (
              <ArrowDown className="h-4 w-4" />
            )
          ) : (
            <ArrowUpDown className="h-4 w-4 opacity-50" />
          )}
        </span>
      </div>
    </th>
  );
};

// Helper to get nested object values like "resident.name"
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
};

// Hook for managing sort state
export const useSortableTable = <T,>(
  data: T[],
  defaultSortKey?: string,
  defaultDirection: SortDirection = 'asc'
) => {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      // Cycle: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortKey || !sortDirection) return 0;

    const aVal = getNestedValue(a, sortKey);
    const bVal = getNestedValue(b, sortKey);

    // Handle null/undefined
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
    if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

    // Compare values
    let comparison = 0;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      comparison = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
    } else if (typeof aVal === 'number' && typeof bVal === 'number') {
      comparison = aVal - bVal;
    } else if (aVal instanceof Date && bVal instanceof Date) {
      comparison = aVal.getTime() - bVal.getTime();
    } else {
      comparison = String(aVal).localeCompare(String(bVal));
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return {
    sortKey,
    sortDirection,
    handleSort,
    sortedData
  };
};
