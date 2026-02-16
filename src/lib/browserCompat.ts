export interface BrowserInfo {
  name: string;
  version: string;
  isSupported: boolean;
  warnings: string[];
}

const checkBrowserSupport = (name: string, version: number): boolean => {
  const minimumVersions: Record<string, number> = {
    Chrome: 90,
    Firefox: 88,
    Safari: 14,
    Edge: 90,
  };
  const minimum = minimumVersions[name];
  if (!minimum) return false;
  return version >= minimum;
};

export const detectBrowser = (): BrowserInfo => {
  const userAgent = navigator.userAgent;
  let name = 'Unknown';
  let version = '0';
  const warnings: string[] = [];

  if (userAgent.includes('Firefox')) {
    name = 'Firefox';
    version = userAgent.match(/Firefox\/(\d+)/)?.[1] || '0';
  } else if (userAgent.includes('Edg')) {
    name = 'Edge';
    version = userAgent.match(/Edg\/(\d+)/)?.[1] || '0';
  } else if (userAgent.includes('Chrome')) {
    name = 'Chrome';
    version = userAgent.match(/Chrome\/(\d+)/)?.[1] || '0';
  } else if (userAgent.includes('Safari')) {
    name = 'Safari';
    version = userAgent.match(/Version\/(\d+)/)?.[1] || '0';
  }

  const parsed = parseInt(version, 10);
  const isSupported = checkBrowserSupport(name, Number.isNaN(parsed) ? 0 : parsed);
  if (!isSupported) warnings.push('Your browser version may not be fully supported.');
  if (!('localStorage' in window)) warnings.push('localStorage not available.');
  if (!('sessionStorage' in window)) warnings.push('sessionStorage not available.');
  if (!navigator.onLine) warnings.push('Browser reports offline status.');

  return { name, version, isSupported, warnings };
};

export const initBrowserCompatibility = (): void => {
  const browserInfo = detectBrowser();

  if (import.meta.env.DEV) {
    console.info('Browser:', browserInfo.name, browserInfo.version);
  }

  if (browserInfo.warnings.length > 0) {
    console.warn('Browser compatibility warnings:', browserInfo.warnings);
  }

  try {
    sessionStorage.setItem('browser_info', JSON.stringify(browserInfo));
  } catch (error) {
    console.warn('Failed to persist browser info to sessionStorage:', error);
  }
};

export const testLocalStorage = (): boolean => {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

export const getStorageQuota = async (): Promise<{ used: number; total: number } | null> => {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      return { used: estimate.usage || 0, total: estimate.quota || 0 };
    } catch (error) {
      console.error('Failed to estimate storage:', error);
    }
  }
  return null;
};
