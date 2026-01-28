// Storage Abstraction Layer - Ready for Cloudflare D1 Migration
// This interface allows swapping localStorage for D1 without changing business logic

import type { ICNDatabase } from '../database';

/**
 * Storage adapter interface
 * Implement this for different backends (localStorage, D1, etc.)
 */
export interface StorageAdapter {
  /**
   * Load the entire database
   */
  load(): Promise<ICNDatabase>;
  
  /**
   * Save the entire database
   */
  save(db: ICNDatabase): Promise<void>;
  
  /**
   * Clear all data
   */
  clear(): Promise<void>;
  
  /**
   * Get adapter name for debugging
   */
  readonly name: string;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /** Storage key prefix */
  keyPrefix?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Result type for operations that may fail
 */
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
