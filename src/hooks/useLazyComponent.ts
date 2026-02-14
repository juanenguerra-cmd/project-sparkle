/**
 * Custom Hook for Lazy Component Loading
 * 
 * Provides utilities for dynamically loading components with loading states
 */

import { lazy, ComponentType, LazyExoticComponent } from 'react';

interface LazyLoadOptions {
  /**
   * Preload the component after a delay (in ms)
   */
  preloadAfter?: number;
  
  /**
   * Retry loading on failure
   */
  retry?: boolean;
}

/**
 * Create a lazy component with retry logic
 */
export const lazyWithRetry = <T extends ComponentType<unknown>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
): LazyExoticComponent<T> => {
  const { retry = true } = options;

  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attempt = () => {
        importFunc()
          .then(resolve)
          .catch((error) => {
            if (retry) {
              // Retry after 1 second
              console.warn('Failed to load component, retrying...', error);
              setTimeout(attempt, 1000);
            } else {
              reject(error);
            }
          });
      };

      attempt();
    });
  });
};

/**
 * Preload a lazy component
 */
export const preloadComponent = <T extends ComponentType<unknown>>(
  lazyComponent: LazyExoticComponent<T>
): void => {
  // Access the _ctor property to trigger loading
  // This is an internal React implementation detail
  const component = lazyComponent as unknown as { _ctor?: () => Promise<unknown> };
  if (component._ctor) {
    component._ctor();
  }
};

/**
 * Hook to preload components on hover
 */
export const usePreloadOnHover = <T extends ComponentType<unknown>>(
  lazyComponent: LazyExoticComponent<T>
) => {
  const handleMouseEnter = () => {
    preloadComponent(lazyComponent);
  };

  return { onMouseEnter: handleMouseEnter };
};
