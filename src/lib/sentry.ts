/**
 * Sentry Error Tracking Configuration
 * 
 * Setup Sentry for error monitoring and performance tracking.
 * Requires environment variables:
 * - VITE_SENTRY_DSN: Your Sentry project DSN
 * - VITE_SENTRY_ENVIRONMENT: Environment name (development, staging, production)
 * - VITE_APP_VERSION: Application version for release tracking
 */

import * as Sentry from '@sentry/react';

interface SentryConfig {
  dsn: string;
  environment: string;
  version: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

/**
 * Initialize Sentry error tracking
 * Should be called once at application startup
 */
export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  // Don't initialize Sentry if DSN is not configured
  if (!dsn) {
    console.warn('Sentry DSN not configured. Error tracking is disabled.');
    return;
  }

  const config: SentryConfig = {
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development',
    version: import.meta.env.VITE_APP_VERSION || '0.0.0',
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  };

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    release: `project-sparkle@${config.version}`,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: config.tracesSampleRate,
    replaysSessionSampleRate: config.replaysSessionSampleRate,
    replaysOnErrorSampleRate: config.replaysOnErrorSampleRate,
    
    // Filter out sensitive data
    beforeSend(event) {
      // Remove sensitive healthcare data from error reports
      if (event.request?.data) {
        event.request.data = '[Filtered]';
      }
      
      // Filter PHI from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
          if (breadcrumb.data) {
            const filtered = { ...breadcrumb.data };
            // Remove common PHI fields
            delete filtered.mrn;
            delete filtered.dateOfBirth;
            delete filtered.firstName;
            delete filtered.lastName;
            delete filtered.ssn;
            return { ...breadcrumb, data: filtered };
          }
          return breadcrumb;
        });
      }
      
      return event;
    },
  });

  console.log(`Sentry initialized for ${config.environment}`);
};

/**
 * Set user context for error tracking
 * Use anonymized or hashed identifiers to protect privacy
 */
export const setUserContext = (userId: string, facilityId?: string): void => {
  Sentry.setUser({
    id: userId,
    facility: facilityId,
  });
};

/**
 * Clear user context (on logout)
 */
export const clearUserContext = (): void => {
  Sentry.setUser(null);
};

/**
 * Capture custom error with additional context
 */
export const captureError = (
  error: Error,
  context?: Record<string, unknown>
): void => {
  Sentry.captureException(error, {
    extra: context,
  });
};

/**
 * Capture custom message
 */
export const captureMessage = (
  message: string,
  level: Sentry.SeverityLevel = 'info'
): void => {
  Sentry.captureMessage(message, level);
};

/**
 * Add breadcrumb for debugging
 */
export const addBreadcrumb = (
  message: string,
  category: string,
  data?: Record<string, unknown>
): void => {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info',
  });
};

export default Sentry;
