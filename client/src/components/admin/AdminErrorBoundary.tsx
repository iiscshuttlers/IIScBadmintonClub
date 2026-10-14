import { Component, ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Catches a crash inside one admin panel so it renders a recoverable card
 * instead of blanking the whole /admin shell. Keyed by the active tab in
 * SiteAdmin, so navigating to another section (which remounts this boundary)
 * clears the error automatically.
 */
interface Props {
  children: ReactNode;
  /** Shown in the fallback so the maintainer knows which panel failed. */
  panelLabel?: string;
}
interface State {
  error: Error | null;
}

export class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Surface for diagnostics; these panels are @ts-nocheck so runtime is the
    // only safety net.
    console.error(`[admin] panel "${this.props.panelLabel ?? "?"}" crashed:`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-rose-500/40 bg-rose-500/5 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <p className="text-base font-black text-foreground">
          {this.props.panelLabel ? `The "${this.props.panelLabel}" panel hit an error` : "This panel hit an error"}
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          The rest of the admin console is still working. You can retry this panel or switch to another section.
        </p>
        {error.message && (
          <code className="mx-4 max-w-md truncate rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground">
            {error.message}
          </code>
        )}
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-1 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:opacity-90"
        >
          <RotateCcw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }
}
