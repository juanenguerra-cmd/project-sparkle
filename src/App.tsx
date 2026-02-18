import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import Index from './pages/Index';
import StaffManagementPage from './pages/StaffManagementPage';
import NotFound from './pages/NotFound';
import LoginPage from './components/pages/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { cleanupSessionMonitoring, initSessionMonitoring, isAuthenticated } from './lib/auth';
import ErrorBoundary from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    if (isAuthenticated()) initSessionMonitoring();
    return () => cleanupSessionMonitoring();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary>
          <OfflineBanner />
          <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <ProtectedRoute>
                  <StaffManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="*"
              element={isAuthenticated() ? <NotFound /> : <Navigate to="/login" replace />}
            />
          </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
