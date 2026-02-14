/**
 * Analytics Service
 * 
 * Centralized analytics tracking for user behavior and feature usage
 * Supports multiple analytics providers (Google Analytics, Mixpanel, etc.)
 */

import { addBreadcrumb } from './sentry';

interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  properties?: Record<string, unknown>;
}

interface UserProperties {
  userId?: string;
  facilityId?: string;
  role?: string;
  [key: string]: unknown;
}

/**
 * Analytics service class
 */
class AnalyticsService {
  private enabled: boolean;
  private providers: Set<string>;

  constructor() {
    this.enabled = !import.meta.env.DEV;
    this.providers = new Set();
    this.initialize();
  }

  /**
   * Initialize analytics providers
   */
  private initialize(): void {
    // Google Analytics initialization
    if (import.meta.env.VITE_GA_MEASUREMENT_ID) {
      this.initializeGoogleAnalytics();
      this.providers.add('ga');
    }

    // Add other providers here (Mixpanel, Amplitude, etc.)
  }

  /**
   * Initialize Google Analytics
   */
  private initializeGoogleAnalytics(): void {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
    
    if (!measurementId) {
      return;
    }

    // Load GA script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    // Initialize GA
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: false, // We'll send page views manually
      anonymize_ip: true, // HIPAA compliance
    });
  }

  /**
   * Track page view
   */
  pageView(path: string, title?: string): void {
    if (!this.enabled) {
      return;
    }

    if (this.providers.has('ga') && window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: path,
        page_title: title,
      });
    }

    // Add breadcrumb for debugging
    addBreadcrumb('Page View', 'navigation', { path, title });
  }

  /**
   * Track custom event
   */
  trackEvent({ category, action, label, value, properties }: AnalyticsEvent): void {
    if (!this.enabled) {
      return;
    }

    if (this.providers.has('ga') && window.gtag) {
      window.gtag('event', action, {
        event_category: category,
        event_label: label,
        value,
        ...properties,
      });
    }

    // Add breadcrumb for debugging
    addBreadcrumb(`Event: ${action}`, category, { label, value, ...properties });
  }

  /**
   * Track feature usage
   */
  trackFeature(featureName: string, properties?: Record<string, unknown>): void {
    this.trackEvent({
      category: 'Feature',
      action: 'Used',
      label: featureName,
      properties,
    });
  }

  /**
   * Track form submission
   */
  trackFormSubmit(formName: string, success: boolean): void {
    this.trackEvent({
      category: 'Form',
      action: success ? 'Submit Success' : 'Submit Error',
      label: formName,
    });
  }

  /**
   * Track export action
   */
  trackExport(exportType: string, format: string): void {
    this.trackEvent({
      category: 'Export',
      action: 'Generated',
      label: exportType,
      properties: { format },
    });
  }

  /**
   * Track report view
   */
  trackReportView(reportType: string): void {
    this.trackEvent({
      category: 'Report',
      action: 'Viewed',
      label: reportType,
    });
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: UserProperties): void {
    if (!this.enabled) {
      return;
    }

    if (this.providers.has('ga') && window.gtag) {
      window.gtag('set', 'user_properties', properties);
    }
  }

  /**
   * Track timing/performance
   */
  trackTiming(category: string, variable: string, time: number): void {
    if (!this.enabled) {
      return;
    }

    if (this.providers.has('ga') && window.gtag) {
      window.gtag('event', 'timing_complete', {
        name: variable,
        value: time,
        event_category: category,
      });
    }
  }

  /**
   * Enable/disable analytics
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

// Export singleton instance
export const analytics = new AnalyticsService();

// Extend Window interface for TypeScript
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export default analytics;
