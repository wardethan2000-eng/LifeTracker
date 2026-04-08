import { useAuth as useClerkAuth } from "@clerk/clerk-expo";

/**
 * Auth state wrapper. In dev mode (__DEV__), Clerk is bypassed entirely —
 * the hook returns a synthetic "always signed in" state.
 *
 * In production, this delegates to Clerk's useAuth().
 */
export function useAuth(): {
  isSignedIn: boolean;
  isLoaded: boolean;
  userId: string | null;
  signOut: () => Promise<void>;
} {
  if (__DEV__) {
    // Dev bypass — always authenticated
    return {
      isSignedIn: true,
      isLoaded: true,
      userId: process.env.EXPO_PUBLIC_AEGIS_DEV_USER_ID ?? "dev-user",
      signOut: async () => {
        // No-op in dev mode
      },
    };
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { isSignedIn, isLoaded, userId, signOut } = useClerkAuth();

  return {
    isSignedIn: isSignedIn ?? false,
    isLoaded,
    userId: userId ?? null,
    signOut,
  };
}
