"use client";

import { useEffect, type JSX } from "react";
import { useRouter } from "next/navigation";

type RoutePrefetcherProps = {
  routes: string[];
};

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

export function RoutePrefetcher({ routes }: RoutePrefetcherProps): JSX.Element | null {
  const router = useRouter();

  useEffect(() => {
    const warmRoutes = () => {
      for (const route of routes) {
        router.prefetch(route);
      }
    };

    const browserWindow = window as IdleWindow;

    if (typeof browserWindow.requestIdleCallback === "function") {
      const idleId = browserWindow.requestIdleCallback(warmRoutes, { timeout: 1500 });

      return () => {
        if (typeof browserWindow.cancelIdleCallback === "function") {
          browserWindow.cancelIdleCallback(idleId);
        }
      };
    }

    const timeoutId = window.setTimeout(warmRoutes, 400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [router, routes]);

  return null;
}