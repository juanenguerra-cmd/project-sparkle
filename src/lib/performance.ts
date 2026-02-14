/**
 * Performance optimization utilities
 * Includes memoization, debouncing, and virtual scrolling helpers
 */

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

class MemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxAge: number;
  private maxSize: number;

  constructor(maxAge: number = 5 * 60 * 1000, maxSize: number = 100) {
    this.maxAge = maxAge;
    this.maxSize = maxSize;
  }

  set(key: string, value: T): void {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const queryCache = new MemoryCache<any>(5 * 60 * 1000);
export const computationCache = new MemoryCache<any>(10 * 60 * 1000);

export const lazyLoadList = <T>(
  items: T[],
  batchSize: number = 50
): {
  loadMore: () => void;
  hasMore: () => boolean;
  visibleItems: () => T[];
  reset: () => void;
} => {
  let currentIndex = 0;
  let currentVisibleItems: T[] = [];

  const loadMore = () => {
    const nextBatch = items.slice(currentIndex, currentIndex + batchSize);
    currentVisibleItems = [...currentVisibleItems, ...nextBatch];
    currentIndex += batchSize;
  };

  const hasMore = () => currentIndex < items.length;

  const visibleItems = () => currentVisibleItems;

  const reset = () => {
    currentIndex = 0;
    currentVisibleItems = [];
  };

  return {
    loadMore,
    hasMore,
    visibleItems,
    reset
  };
};

export class DataIndex<T> {
  private indices: Map<string, Map<any, T[]>> = new Map();

  buildIndex(data: T[], field: string): void {
    const index = new Map<any, T[]>();

    data.forEach(item => {
      const value = (item as any)[field];
      if (!index.has(value)) {
        index.set(value, []);
      }
      index.get(value)!.push(item);
    });

    this.indices.set(field, index);
  }

  query(field: string, value: any): T[] {
    const index = this.indices.get(field);
    if (!index) return [];

    return index.get(value) || [];
  }

  clearIndex(field: string): void {
    this.indices.delete(field);
  }

  clearAll(): void {
    this.indices.clear();
  }
}

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  measure<T>(label: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);

    const measurements = this.metrics.get(label)!;
    if (measurements.length > 100) {
      measurements.shift();
    }

    return result;
  }

  async measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);

    return result;
  }

  getStats(label: string): { avg: number; min: number; max: number; count: number } | null {
    const measurements = this.metrics.get(label);
    if (!measurements || measurements.length === 0) return null;

    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    return { avg, min, max, count: measurements.length };
  }

  getAllStats(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    this.metrics.forEach((_, label) => {
      const labelStats = this.getStats(label);
      if (labelStats) {
        stats[label] = labelStats;
      }
    });

    return stats;
  }

  clear(): void {
    this.metrics.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();

export { debounce as useDebounce, throttle as useThrottle };
