'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorBoundaryProps {
  children: ReactNode;
  variant?: 'full-page' | 'inline';
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isFullPage = this.props.variant === 'full-page';

      return (
        <div
          data-testid="error-boundary"
          data-variant={this.props.variant ?? 'inline'}
          className={cn(
            'flex flex-col items-center justify-center gap-4 text-center',
            isFullPage ? 'min-h-[400px] p-12' : 'rounded-lg border p-6',
          )}
        >
          <AlertTriangle className={cn('text-destructive', isFullPage ? 'h-12 w-12' : 'h-8 w-8')} />
          <div className="space-y-1">
            <h3 className={cn('font-medium', isFullPage ? 'text-lg' : 'text-sm')}>
              Something went wrong
            </h3>
            <p className="text-sm text-muted-foreground">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleReset}>
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
