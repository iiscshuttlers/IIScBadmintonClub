import { ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { AppUpdateProvider } from "./hooks/useAppUpdate";
import { AppModeProvider } from "./contexts/AppModeContext";
import { RealtimeProvider } from "./providers/RealtimeProvider";
import { ConfirmProvider } from "./contexts/ConfirmContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff + jitter
    },
  },
});

const persister = createSyncStoragePersister({
  storage: window.sessionStorage,
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider defaultTheme="dark" switchable>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
        <AuthProvider>
          <AppUpdateProvider>
            <AppModeProvider>
              <ConfirmProvider>
                <RealtimeProvider>
                  {children}
                </RealtimeProvider>
              </ConfirmProvider>
            </AppModeProvider>
          </AppUpdateProvider>
        </AuthProvider>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
