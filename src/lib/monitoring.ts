/**
 * Performance Monitoring Utilities
 * 
 * Track application performance metrics
 */

import { analytics } from './analytics';

interface PerformanceMetric {
  name: string;
  value: number;
  category: string;
}

/**
 * Measure component render time
 */
export const measureRenderTime = (componentName: string): (() => void) => {
  const startTime = performance.now();

  return () => {
    const endTime = performance.now();
    const renderTime = endTime - startTime;

    if (renderTime > 100) {
      // Log slow renders
      console.warn(`Slow render detected: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }

    analytics.trackTiming('Component', componentName, Math.round(renderTime));
  };
};

/**
 * Measure API call duration
 */
export const measureApiCall = async <T>(
  endpoint: string,
  apiCall: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();

  try {
    const result = await apiCall();
    const duration = performance.now() - startTime;

    analytics.trackTiming('API', endpoint, Math.round(duration));

    if (duration > 3000) {
      console.warn(`Slow API call: ${endpoint} took ${duration.toFixed(2)}ms`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    analytics.trackTiming('API Error', endpoint, Math.round(duration));
    throw error;
  }
};

/**
 * Report Web Vitals
 */
export const reportWebVitals = (): void => {
  if ('web-vital' in window) {
    // This would require importing web-vitals library
    // For now, use basic performance APIs
  }

  // Report Core Web Vitals when available
  if (window.performance && window.performance.timing) {
    const timing = window.performance.timing;
    const loadTime = timing.loadEventEnd - timing.navigationStart;

    analytics.trackTiming('Web Vitals', 'Page Load', loadTime);
  }
};

/**
 * Monitor memory usage (if available)
 */
export const monitorMemory = (): void => {
  if ('memory' in performance) {
    const memory = (performance as unknown as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
    const usedMemoryMB = memory.usedJSHeapSize / 1048576;
    const totalMemoryMB = memory.totalJSHeapSize / 1048576;

    if (usedMemoryMB > 50) {
      console.warn(
        `High memory usage: ${usedMemoryMB.toFixed(2)}MB / ${totalMemoryMB.toFixed(2)}MB`
      );
    }
  }
};
