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
      
      // After max errors, show an explicit fallback UI with recovery actions
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background px-6">
          <div className="max-w-md w-full rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Se produjo un error inesperado</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Hemos protegido la aplicación para evitar un bloqueo. Puedes recargar para recuperarte o volver al inicio de sesión.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                onClick={() => window.location.reload()}
              >
                Recargar aplicación
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground"
                onClick={() => {
                  window.location.href = '/login';
                }}
              >
                Ir a inicio de sesión
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
