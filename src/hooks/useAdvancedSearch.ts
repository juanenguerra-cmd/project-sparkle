import { useState, useMemo } from 'react';

export interface SearchFilters {
  searchTerm: string;
  dateRange: { start: string; end: string };
  status: string[];
  categories: string[];
  [key: string]: any;
}

export interface SearchableItem {
  [key: string]: any;
}

export const useAdvancedSearch = <T extends SearchableItem>(
  items: T[],
  searchFields: string[],
  initialFilters: Partial<SearchFilters> = {}
) => {
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    dateRange: { start: '', end: '' },
    status: [],
    categories: [],
    ...initialFilters
  });

  const [sortConfig, setSortConfig] = useState<{
    field: string;
    direction: 'asc' | 'desc';
  }>({ field: '', direction: 'asc' });

  const getNestedValue = (obj: any, path: string): any => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const searchItems = (itemsToSearch: T[], searchTerm: string): T[] => {
    if (!searchTerm) return itemsToSearch;

    const searchLower = searchTerm.toLowerCase();

    return itemsToSearch.filter(item => {
      return searchFields.some(field => {
        const value = getNestedValue(item, field);
        if (value === null || value === undefined) return false;

        return String(value).toLowerCase().includes(searchLower);
      });
    });
  };

  const filterItems = (sourceItems: T[]): T[] => {
    let filtered = sourceItems;

    filtered = searchItems(filtered, filters.searchTerm);

    if (filters.dateRange.start) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date || item.createdAt || item.onset_date || '');
        const startDate = new Date(filters.dateRange.start);
        return itemDate >= startDate;
      });
    }

    if (filters.dateRange.end) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.date || item.createdAt || item.onset_date || '');
        const endDate = new Date(filters.dateRange.end);
        endDate.setHours(23, 59, 59, 999);
        return itemDate <= endDate;
      });
    }

    if (filters.status.length > 0) {
      filtered = filtered.filter(item => filters.status.includes(item.status));
    }

    if (filters.categories.length > 0) {
      filtered = filtered.filter(item =>
        filters.categories.some(cat =>
          item.category === cat ||
          item.type === cat ||
          item.precaution_type === cat
        )
      );
    }

    Object.keys(filters).forEach(key => {
      if (!['searchTerm', 'dateRange', 'status', 'categories'].includes(key)) {
        const filterValue = filters[key];
        if (filterValue && filterValue !== 'all') {
          filtered = filtered.filter(item => item[key] === filterValue);
        }
      }
    });

    return filtered;
  };

  const sortItems = (itemsToSort: T[]): T[] => {
    if (!sortConfig.field) return itemsToSort;

    return [...itemsToSort].sort((a, b) => {
      const aValue = getNestedValue(a, sortConfig.field);
      const bValue = getNestedValue(b, sortConfig.field);

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      let comparison = 0;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (aValue instanceof Date && bValue instanceof Date) {
        comparison = aValue.getTime() - bValue.getTime();
      } else {
        comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  };

  const results = useMemo(() => {
    const filtered = filterItems(items);
    return sortItems(filtered);
  }, [items, filters, sortConfig]);

  const updateFilter = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      dateRange: { start: '', end: '' },
      status: [],
      categories: [],
      ...initialFilters
    });
    setSortConfig({ field: '', direction: 'asc' });
  };

  const toggleSort = (field: string) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return {
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    sortConfig,
    toggleSort,
    results,
    totalResults: results.length,
    totalItems: items.length
  };
};
