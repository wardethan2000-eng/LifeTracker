"use client";

import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "../components/theme-provider";
import { ToastProvider } from "../components/toast-provider";
import { StorageModeProvider } from "../lib/data-access";
import { queryClient } from "../lib/query-client";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps): ReactNode {
  return (
    <QueryClientProvider client={queryClient}>
      <StorageModeProvider>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </StorageModeProvider>
    </QueryClientProvider>
  );
}
