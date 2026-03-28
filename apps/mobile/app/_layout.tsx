import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { QueryClientProvider } from "@tanstack/react-query";
import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { clerkTokenCache } from "../lib/storage";
import { queryClient, setupQueryPersistence } from "../lib/query-client";
import { lightTheme, darkTheme } from "../lib/theme";
import { registerClerkTokenGetter } from "../lib/api";
import { CLERK_PUBLISHABLE_KEY } from "../lib/constants";

// Keep the splash screen visible until we finish checking auth state
SplashScreen.preventAutoHideAsync();

// Set up React Query cache persistence on startup
setupQueryPersistence();

// ---------------------------------------------------------------------------
// Auth gate — redirects to (auth) or (tabs) based on sign-in state
// ---------------------------------------------------------------------------

function AuthGate() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Register the Clerk token getter so the API client can obtain bearer tokens
  useEffect(() => {
    registerClerkTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    }

    SplashScreen.hideAsync();
  }, [isSignedIn, isLoaded, segments, router]);

  return <Slot />;
}

// ---------------------------------------------------------------------------
// Dev bypass — skips Clerk entirely in development
// ---------------------------------------------------------------------------

function DevBypassGate() {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";
    if (inAuthGroup) {
      router.replace("/(tabs)");
    }
    SplashScreen.hideAsync();
  }, [segments, router]);

  return <Slot />;
}

// ---------------------------------------------------------------------------
// Root layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === "dark" ? darkTheme : lightTheme;

  const content = __DEV__ ? (
    <DevBypassGate />
  ) : (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      tokenCache={clerkTokenCache}
    >
      <AuthGate />
    </ClerkProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={theme}>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            {content}
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
