import { Component, ReactNode } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

const MAX_ERROR_COUNT = 3;
const ERROR_RESET_MS = 5000; // Reset error state after 5 seconds

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;
  private lastErrorTime: number = 0;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const now = Date.now();
    
    // Reset error count if enough time has passed
    if (now - this.lastErrorTime > ERROR_RESET_MS) {
      this.setState({ errorCount: 1 });
    } else {
      this.setState(prev => ({ errorCount: prev.errorCount + 1 }));
    }
    this.lastErrorTime = now;
    
    // Only log errors, don't auto-reload (causes navigation issues)
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error details:', error.message);
    
    // Try to recover by resetting error state after a short delay
    // This allows React to re-attempt rendering without a full page reload
    if (this.state.errorCount < MAX_ERROR_COUNT) {
      this.resetTimeoutId = window.setTimeout(() => {
        this.setState({ hasError: false, error: null });
      }, 100);
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      window.clearTimeout(this.resetTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // If errors keep happening, show a simple loading state briefly
      // then try to render again
      if (this.state.errorCount < MAX_ERROR_COUNT) {
        return (
          <div className="min-h-screen w-full flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner size="lg" />
              <p className="text-muted-foreground text-sm">Cargando...</p>
            </div>
          </div>
        );
      }
      
      // After max errors, just render nothing (no error screen)
      // User can manually navigate away or refresh
      return null;
    }

    return this.props.children;
  }
}
