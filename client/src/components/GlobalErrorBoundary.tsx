import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center text-soft p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-danger/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-danger" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-foreground">Something went wrong</h2>
              <p className="text-muted-foreground text-sm">
                The application encountered an unexpected error.
              </p>
            </div>

            <div className="w-full bg-background rounded-xl p-4 overflow-x-auto text-left border border-border">
              <code className="text-xs text-danger font-mono">
                {this.state.error?.message || "Unknown error"}
              </code>
            </div>

            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 py-4 bg-primary text-primary-foreground rounded-2xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 active:scale-[0.98]"
            >
              <RefreshCcw className="w-5 h-5" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
