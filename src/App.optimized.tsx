/**
 * Optimized App Component with Lazy Loading
 * 
 * Implements code splitting and lazy loading for improved performance
 * Replace your existing App.tsx with this optimized version
 */

import { Suspense, lazy } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';

// Lazy load page components for code splitting
const Index = lazy(() => import('@/pages/Index'));
const Residents = lazy(() => import('@/pages/Residents'));
const Antibiotics = lazy(() => import('@/pages/Antibiotics'));
const Outbreaks = lazy(() => import('@/pages/Outbreaks'));
const Immunizations = lazy(() => import('@/pages/Immunizations'));
const Reports = lazy(() => import('@/pages/Reports'));
const Settings = lazy(() => import('@/pages/Settings'));

// Create Query Client outside component to prevent recreation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Loading fallback component
 */
const PageLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <LoadingSpinner size="lg" />
  </div>
);

const App = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/residents" element={<Residents />} />
                <Route path="/antibiotics" element={<Antibiotics />} />
                <Route path="/outbreaks" element={<Outbreaks />} />
                <Route path="/immunizations" element={<Immunizations />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster />
          <Sonner />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
