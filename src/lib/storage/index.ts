// Storage Layer Entry Point
import { LocalStorageAdapter } from './localStorageAdapter';

export type { StorageAdapter, StorageConfig, StorageResult } from './types';
export { defaultDatabase, defaultSettings } from './defaults';

// Always use LocalStorageAdapter as D1 has been removed
export const storage = new LocalStorageAdapter({
  debug: import.meta.env.DEV,
});
