import React from 'react';
import { AlertTriangle, RefreshCw, RotateCcw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { createAuditLog } from '@/lib/audit';
import { exportBackupToFile, listBackups, createManualBackup } from '@/lib/backup';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });
    try {
      createAuditLog('create', 'note', `error_${Date.now()}`, `Application Error: ${error.message}`);
    } catch (auditError) {
      console.error('Failed to log error to audit:', auditError);
    }
  }

  handleReload = () => window.location.reload();

  handleReset = () => this.setState({ hasError: false, error: null, errorInfo: null });

  handleCreateBackup = () => {
    try {
      createManualBackup();
      alert('Backup created successfully. You can now safely try recovery options.');
    } catch {
      alert('Failed to create backup. Please contact support.');
    }
  };

  handleExportLastBackup = () => {
    try {
      const backups = listBackups();
      if (backups.length > 0) exportBackupToFile(backups[0].id);
      else alert('No backups available to export.');
    } catch {
      alert('Failed to export backup.');
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="w-full max-w-2xl">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Application Error</h1>
                  <p className="text-sm text-gray-600">Something went wrong. Your data is safe.</p>
                </div>
              </div>

              {this.state.error && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Error Details:</h3>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-mono text-red-900 break-all">{this.state.error.message}</p>
                  </div>
                </div>
              )}

              <div className="space-y-3 mb-6">
                <h3 className="text-sm font-semibold text-gray-700">Recovery Options:</h3>
                <Button onClick={this.handleReload} className="w-full" size="lg">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Application
                </Button>
                <Button onClick={this.handleReset} variant="outline" className="w-full" size="lg">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Try Again (Keep Current View)
                </Button>
                <div className="grid grid-cols-2 gap-3">
                  <Button onClick={this.handleCreateBackup} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Create Backup
                  </Button>
                  <Button onClick={this.handleExportLastBackup} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export Backup
                  </Button>
                </div>
              </div>

              {this.state.errorInfo && (
                <details className="mt-4">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900">Technical Details (for support)</summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-3 rounded overflow-auto max-h-40">{this.state.errorInfo.componentStack}</pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
