// Storage Layer Entry Point
// 
// To switch storage backends, update the adapter export below.

import { D1StorageAdapter } from './d1Adapter';
import { LocalStorageAdapter } from './localStorageAdapter';

export type { StorageAdapter, StorageConfig, StorageResult } from './types';
export { defaultDatabase, defaultSettings } from './defaults';

// Current active storage adapter
// Use LocalStorage unless D1 is explicitly enabled via env.
const useD1 = import.meta.env.VITE_USE_D1 === 'true';

export const storage = useD1
  ? new D1StorageAdapter({
      apiBase: import.meta.env.VITE_D1_API_BASE_URL,
      debug: import.meta.env.DEV,
    })
  : new LocalStorageAdapter({
      debug: import.meta.env.DEV,
    });
