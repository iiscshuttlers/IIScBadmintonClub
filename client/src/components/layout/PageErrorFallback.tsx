import { ErrorState } from "@/components/ui/ErrorState";

export function PageErrorFallback() {
  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4">
      <ErrorState
        title="This page encountered an error"
        description="Something went wrong while loading this section. The rest of the platform is operational."
        onRetry={() => window.location.reload()}
        homeLink={true}
      />
    </div>
  );
}
