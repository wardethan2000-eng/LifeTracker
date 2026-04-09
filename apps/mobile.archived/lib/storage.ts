import { MMKV } from "react-native-mmkv";
import * as SecureStore from "expo-secure-store";

/**
 * Primary MMKV instance.
 * Used for: mutation queue, upload queue, recent searches, user preferences.
 * Synchronous reads/writes — significantly faster than AsyncStorage for small values.
 */
export const storage = new MMKV({ id: "aegis-storage" });

// ---------------------------------------------------------------------------
// Clerk token cache (SecureStore-backed)
// ---------------------------------------------------------------------------

/**
 * Clerk requires a token cache that persists the session token across app restarts.
 * We use expo-secure-store (hardware-backed Keystore on Android).
 */
export const clerkTokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async clearToken(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};

// ---------------------------------------------------------------------------
// MMKV helpers (typed get/set with JSON serialization for complex values)
// ---------------------------------------------------------------------------

export function mmkvGet<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (raw === undefined) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function mmkvSet<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

export function mmkvDelete(key: string): void {
  storage.delete(key);
}
