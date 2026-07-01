import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional custom fallback. If omitted the full-screen error UI is shown. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error.name === "ChunkLoadError" ||
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Importing a module script failed");
    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error: Error) {
    if (this.state.isChunkError) {
      const reloaded = sessionStorage.getItem("chunk_error_reloaded");
      if (!reloaded) {
        sessionStorage.setItem("chunk_error_reloaded", "true");
        const url = new URL(window.location.href);
        url.searchParams.set("nocache", Date.now().toString());
        window.location.replace(url.toString());
        return;
      }
      // Second ChunkLoadError in same session — unregister SW and reload cleanly
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((r) => r.unregister());
          sessionStorage.removeItem("chunk_error_reloaded");
          window.location.reload();
        });
      }
    } else {
      sessionStorage.removeItem("chunk_error_reloaded");
    }
  }

  render() {
    if (this.state.hasError && this.state.isChunkError) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      );
    }
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;
      return (
        <div className="flex items-center justify-center min-h-screen p-6 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-6">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />

            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>

            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>

            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer",
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
