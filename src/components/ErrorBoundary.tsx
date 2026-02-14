/**
 * Error Boundary Component
 * 
 * Catches React errors and displays fallback UI
 * Optionally integrates with Sentry for error reporting if available
 */

import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo): Promise<void> {
    this.setState({
      errorInfo,
    });

    // Try to log to Sentry if available
    try {
      const Sentry = await import('@sentry/react');
      Sentry.captureException(error, {
        extra: {
          componentStack: errorInfo.componentStack,
        },
      });
    } catch (sentryError) {
      // Sentry not available or not configured, log to console instead
      console.error('Error caught by boundary:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }

    // Always log to console in development
    if (import.meta.env.DEV) {
      console.error('Error caught by boundary:', error);
      console.error('Component stack:', errorInfo.componentStack);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription className="mt-2">
                <p className="mb-4">
                  We're sorry, but something unexpected happened. The error has been
                  logged.
                </p>
                {import.meta.env.DEV && this.state.error && (
                  <details className="mt-4 p-2 bg-muted rounded text-xs">
                    <summary className="cursor-pointer font-semibold">
                      Error Details (Development Only)
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words">
                      {this.state.error.toString()}
                    </pre>
                    {this.state.errorInfo && (
                      <pre className="mt-2 whitespace-pre-wrap break-words text-[10px]">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </details>
                )}
                <div className="mt-4 flex gap-2">
                  <Button onClick={this.handleReset} variant="outline">
                    Try Again
                  </Button>
                  <Button onClick={() => window.location.reload()} variant="default">
                    Reload Page
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
