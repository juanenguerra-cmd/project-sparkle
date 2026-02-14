import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export const OfflineBanner = () => {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="bg-yellow-500 text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium sticky top-0 z-50 shadow-md">
      <WifiOff className="w-4 h-4" />
      <span>Offline Mode - All changes are saved locally</span>
    </div>
  );
};
