// Storage Layer Entry Point
// 
// TO SWITCH TO D1:
// 1. Rename d1Adapter.template.ts to d1Adapter.ts
// 2. Update the API_BASE_URL in d1Adapter.ts
// 3. Change the export below to use D1StorageAdapter

import { LocalStorageAdapter } from './localStorageAdapter';
// import { D1StorageAdapter } from './d1Adapter';

export type { StorageAdapter, StorageConfig, StorageResult } from './types';
export { LocalStorageAdapter } from './localStorageAdapter';
export { defaultDatabase, defaultSettings } from './defaults';

// Current active storage adapter
// Change this line to switch storage backends:
export const storage = new LocalStorageAdapter();

// For D1, uncomment and use:
// export const storage = new D1StorageAdapter({ 
//   apiBase: 'https://your-worker.workers.dev',
//   debug: true 
// });
