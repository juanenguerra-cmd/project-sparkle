// Storage Layer Entry Point
// 
// To switch storage backends, update the adapter export below.

import { D1StorageAdapter } from './d1Adapter';

export type { StorageAdapter, StorageConfig, StorageResult } from './types';
export { LocalStorageAdapter } from './localStorageAdapter';
export { defaultDatabase, defaultSettings } from './defaults';

// Current active storage adapter
// Change this line to switch storage backends:
export const storage = new D1StorageAdapter({
  apiBase: import.meta.env.VITE_D1_API_BASE_URL,
  debug: import.meta.env.DEV,
});
