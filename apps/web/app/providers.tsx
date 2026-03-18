"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "../components/theme-provider";
import { ToastProvider } from "../components/toast-provider";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps): ReactNode {
  return (
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}