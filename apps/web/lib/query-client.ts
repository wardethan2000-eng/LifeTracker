import { QueryClient } from "@tanstack/react-query";

/**
 * Shared React Query client.
 *
 * - `staleTime` of 30 s matches the default ISR revalidation window so
 *   client-side navigations don't redundantly re-fetch fresh server data.
 * - Analytics queries use a 10-min stale window (600 s) to match ISR.
 * - Errors are not retried by default in tests; adjust via `retry` per-query.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false
    }
  }
});
