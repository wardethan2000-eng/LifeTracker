import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import { QueryClientProvider } from "@tanstack/react-query";
import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Platform, useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { clerkTokenCache } from "../lib/storage";
import { queryClient, setupQueryPersistence } from "../lib/query-client";
import { lightTheme, darkTheme } from "../lib/theme";
import { registerClerkTokenGetter, registerDevice } from "../lib/api";
import { CLERK_PUBLISHABLE_KEY, STORAGE_KEYS } from "../lib/constants";
import { storage } from "../lib/storage";

// Keep the splash screen visible until we finish checking auth state
SplashScreen.preventAutoHideAsync();

// Set up React Query cache persistence on startup
setupQueryPersistence();

// Configure how notifications are displayed when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ---------------------------------------------------------------------------
// Push notification registration helper
// ---------------------------------------------------------------------------

async function registerForPushNotifications(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0d9488",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    const platform = Platform.OS === "ios" ? "ios" : "android";

    const device = await registerDevice({ token, platform });
    // Persist device ID for unregistration on sign-out
    storage.set(STORAGE_KEYS.DEVICE_TOKEN_ID, device.id);
  } catch (error) {
    console.warn("[push] Failed to register device token:", error);
  }
}

// ---------------------------------------------------------------------------
// Auth gate — redirects to (auth) or (tabs) based on sign-in state
// ---------------------------------------------------------------------------

function AuthGate() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription>();
  const responseListener = useRef<Notifications.EventSubscription>();

  // Register the Clerk token getter so the API client can obtain bearer tokens
  useEffect(() => {
    registerClerkTokenGetter(() => getToken());
  }, [getToken]);

  // Register for push notifications once authenticated
  useEffect(() => {
    if (isSignedIn) {
      registerForPushNotifications();
    }
  }, [isSignedIn]);

  // Handle notification deep links
  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Notification received while app is foregrounded — query client will
      // auto-refetch notification list on next focus
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        const url = typeof data?.url === "string" ? data.url : null;
        if (url) {
          // Strip leading / if present then push as relative path
          router.push(url as `/${string}`);
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [router]);

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
  const responseListener = useRef<Notifications.EventSubscription>();

  useEffect(() => {
    // Register push token in dev mode too (useful for testing with Expo Go)
    registerForPushNotifications();

    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<string, unknown>;
        const url = typeof data?.url === "string" ? data.url : null;
        if (url) {
          router.push(url as `/${string}`);
        }
      }
    );

    return () => {
      responseListener.current?.remove();
    };
  }, [router]);

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
