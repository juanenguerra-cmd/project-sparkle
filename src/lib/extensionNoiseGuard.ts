export interface CapturedExtensionError {
  timestamp: string;
  message: string;
}

const EXTENSION_PROTOCOLS = ['chrome-extension://', 'moz-extension://', 'safari-extension://'] as const;
const EXTENSION_ERROR_LIMIT = 10;

const extensionErrors: CapturedExtensionError[] = [];
const subscribers = new Set<(errors: CapturedExtensionError[]) => void>();

const notify = () => {
  const snapshot = [...extensionErrors];
  subscribers.forEach((subscriber) => subscriber(snapshot));
};

const normalizeErrorMessage = (reason: unknown): string => {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
};

export const isSafeModuleUrl = (url: string): boolean => {
  if (!url || typeof window === 'undefined') return false;
  const normalized = url.trim();

  if (EXTENSION_PROTOCOLS.some((protocol) => normalized.startsWith(protocol))) {
    return false;
  }

  try {
    const parsed = new URL(normalized, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
};

export const isExtensionNoise = (message: string): boolean => {
  const lower = message.toLowerCase();
  return (
    lower.includes('chrome-extension://')
    || lower.includes('moz-extension://')
    || lower.includes('safari-extension://')
    || lower.includes('failed to fetch dynamically imported module')
  );
};

export const captureExtensionNoise = (message: string): void => {
  if (!isExtensionNoise(message)) return;

  extensionErrors.unshift({
    timestamp: new Date().toISOString(),
    message,
  });

  if (extensionErrors.length > EXTENSION_ERROR_LIMIT) {
    extensionErrors.length = EXTENSION_ERROR_LIMIT;
  }

  notify();

  if (import.meta.env.DEV) {
    console.info('[Extension injection detected]', message);
  }
};

export const getCapturedExtensionErrors = (): CapturedExtensionError[] => [...extensionErrors];

export const subscribeToExtensionErrors = (subscriber: (errors: CapturedExtensionError[]) => void): (() => void) => {
  subscribers.add(subscriber);
  subscriber(getCapturedExtensionErrors());
  return () => subscribers.delete(subscriber);
};

export const registerExtensionNoiseHandlers = (): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const onError = (event: ErrorEvent) => {
    const message = [event.message, event.filename].filter(Boolean).join(' | ');
    if (isExtensionNoise(message)) {
      captureExtensionNoise(message);
      event.preventDefault();
    }
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const message = normalizeErrorMessage(event.reason);
    if (isExtensionNoise(message)) {
      captureExtensionNoise(message);
      event.preventDefault();
    }
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
};
