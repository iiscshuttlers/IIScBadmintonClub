export function PageErrorFallback() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12 text-center px-6">
      <div className="text-4xl">🏸</div>
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">This page crashed</h2>
      <p className="text-sm text-muted-foreground dark:text-muted-foreground max-w-xs">
        Something went wrong loading this section. The rest of the app is unaffected.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 text-sm font-bold bg-primary hover:bg-primary text-primary-foreground rounded-xl transition-colors"
        >
          Reload
        </button>
        <a
          href="/"
          className="px-4 py-2 text-sm font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-muted-foreground dark:text-slate-300 rounded-xl transition-colors"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}
