import { describe, it, expect } from 'vitest';
import { performanceMonitor, debounce, DataIndex } from '@/lib/performance';

describe('Performance Utilities', () => {
  describe('Performance Monitor', () => {
    it('should measure function execution time', () => {
      const result = performanceMonitor.measure('test-operation', () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result).toBe(499500);

      const stats = performanceMonitor.getStats('test-operation');
      expect(stats).not.toBeNull();
      expect(stats!.count).toBeGreaterThan(0);
      expect(stats!.avg).toBeGreaterThan(0);
    });
  });

  describe('Debounce', () => {
    it('should debounce function calls', async () => {
      let callCount = 0;
      const debouncedFn = debounce(() => {
        callCount++;
      }, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      expect(callCount).toBe(0);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(callCount).toBe(1);
    });
  });

  describe('Data Index', () => {
    it('should build index and query efficiently', () => {
      const data = [
        { id: '1', status: 'active', name: 'Test 1' },
        { id: '2', status: 'active', name: 'Test 2' },
        { id: '3', status: 'resolved', name: 'Test 3' }
      ];

      const index = new DataIndex<{ id: string; status: string; name: string }>();
      index.buildIndex(data, 'status');

      const activeItems = index.query('status', 'active');
      expect(activeItems.length).toBe(2);
      expect(activeItems[0].id).toBe('1');
    });
  });
});
