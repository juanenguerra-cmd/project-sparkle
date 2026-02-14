import { useState, useEffect } from 'react';
import { toast as sonnerToast } from 'sonner';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      sonnerToast.dismiss('offline-warning');
      if (wasOffline) {
        sonnerToast.success('Connection Restored', {
          description: 'You are back online. Data is syncing normally.',
          duration: 5000,
        });
      }
      setWasOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      sonnerToast.warning('Connection Lost', {
        description: 'Application is now in offline mode. All changes are saved locally.',
        duration: Infinity,
        id: 'offline-warning',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
};
