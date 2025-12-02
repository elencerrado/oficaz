import { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  reloadAttempts: number;
}

const MAX_AUTO_RELOAD_ATTEMPTS = 3;
const RELOAD_ATTEMPT_KEY = 'errorBoundaryReloadAttempts';
const RELOAD_TIMESTAMP_KEY = 'errorBoundaryLastReload';
const RELOAD_TIMEOUT_MS = 60000; // Reset counter after 1 minute

export class ErrorBoundary extends Component<Props, State> {
  private reloadTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    
    // Get reload attempts from sessionStorage
    const storedAttempts = sessionStorage.getItem(RELOAD_ATTEMPT_KEY);
    const lastReload = sessionStorage.getItem(RELOAD_TIMESTAMP_KEY);
    const now = Date.now();
    
    // Reset counter if more than 1 minute has passed
    let reloadAttempts = 0;
    if (storedAttempts && lastReload) {
      const timeSinceLastReload = now - parseInt(lastReload);
      if (timeSinceLastReload < RELOAD_TIMEOUT_MS) {
        reloadAttempts = parseInt(storedAttempts);
      }
    }
    
    this.state = { 
      hasError: false, 
      error: null,
      reloadAttempts 
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Log to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    // Auto-reload if we haven't exceeded max attempts
    if (this.state.reloadAttempts < MAX_AUTO_RELOAD_ATTEMPTS) {
      const newAttempts = this.state.reloadAttempts + 1;
      
      // Store attempt count and timestamp
      sessionStorage.setItem(RELOAD_ATTEMPT_KEY, newAttempts.toString());
      sessionStorage.setItem(RELOAD_TIMESTAMP_KEY, Date.now().toString());
      
      console.log(`Auto-reloading (attempt ${newAttempts}/${MAX_AUTO_RELOAD_ATTEMPTS})...`);
      
      // Auto-reload after a short delay
      this.reloadTimeoutId = window.setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      // If we've exceeded max attempts, clear the counter and just show nothing
      // The page will be blank but won't show an error screen
      console.error('Max reload attempts exceeded. Please manually refresh the page.');
      sessionStorage.removeItem(RELOAD_ATTEMPT_KEY);
      sessionStorage.removeItem(RELOAD_TIMESTAMP_KEY);
    }
  }

  componentWillUnmount() {
    if (this.reloadTimeoutId) {
      window.clearTimeout(this.reloadTimeoutId);
    }
  }

  render() {
    // NEVER show error screen - just reload automatically
    // If error persists after max attempts, show blank page (better than error screen)
    if (this.state.hasError) {
      if (this.state.reloadAttempts < MAX_AUTO_RELOAD_ATTEMPTS) {
        return (
          <div className="min-h-screen w-full flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner size="lg" />
              <p className="text-muted-foreground text-sm">Cargando...</p>
            </div>
          </div>
        );
      }
      
      // If max attempts exceeded, show blank page (no error screen!)
      return null;
    }

    return this.props.children;
  }
}
