import { useEffect, useState } from 'react';
import { importDBFromJSON, loadDB } from '@/lib/database';

/**
 * Hook to auto-load initial data if database is empty
 * This is a one-time loader that fetches from a bundled backup
 */
export const useDataLoader = (onDataLoaded?: () => void) => {
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      // Check if we already have data
      const db = loadDB();
      const hasData = Object.keys(db.census.residentsByMrn).length > 0;
      
      // Check if we've already tried to load
      const hasAttempted = localStorage.getItem('icn_hub_initial_load_attempted');
      
      if (hasData || hasAttempted) {
        setLoaded(true);
        return;
      }

      setLoading(true);
      
      try {
        // Fetch the bundled backup
        const response = await fetch('/data/initial-backup.json');
        if (!response.ok) {
          throw new Error('Failed to fetch initial data');
        }
        
        const jsonText = await response.text();
        const result = await importDBFromJSON(jsonText);
        
        if (result.success) {
          console.log('Initial data loaded:', result.message);
          localStorage.setItem('icn_hub_initial_load_attempted', 'true');
          onDataLoaded?.();
        } else {
          setError(result.message);
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
        setLoaded(true);
        localStorage.setItem('icn_hub_initial_load_attempted', 'true');
      }
    };

    loadInitialData();
  }, [onDataLoaded]);

  return { loading, loaded, error };
};
