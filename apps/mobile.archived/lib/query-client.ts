import { QueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { QUERY_DEFAULTS } from "./constants";

// ---------------------------------------------------------------------------
// QueryClient
// ---------------------------------------------------------------------------

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: QUERY_DEFAULTS.staleTime,
      gcTime: QUERY_DEFAULTS.gcTime,
      retry: QUERY_DEFAULTS.retryCount,
      refetchOnWindowFocus: false,  // RN has no "window focus"
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,  // Mutations are handled by the offline queue on failure
    },
  },
});

// ---------------------------------------------------------------------------
// Offline persistence (AsyncStorage — survives app restarts)
// ---------------------------------------------------------------------------

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "lk-query-cache",
  // Throttle persists to avoid hammering storage on rapid cache updates
  throttleTime: 1000,
});

export function setupQueryPersistence(): void {
  persistQueryClient({
    queryClient,
    persister: asyncStoragePersister,
    maxAge: QUERY_DEFAULTS.gcTime,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        // Only persist successful queries — skip errors and loading states
        return query.state.status === "success";
      },
    },
  });
}
