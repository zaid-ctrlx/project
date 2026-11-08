import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Auth tokens live in the OS keystore (Android Keystore / iOS Keychain) via
// expo-secure-store, so they are encrypted at rest and not readable from a
// device backup or a rooted file dump the way plain AsyncStorage is.
//
// The web build (used only for quick dev checks) has no keystore, so there it
// falls back to AsyncStorage (= browser localStorage). Native is what ships.
const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

const useSecure = Platform.OS !== "web";

async function setItem(key: string, value: string) {
  if (useSecure) await SecureStore.setItemAsync(key, value);
  else await AsyncStorage.setItem(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (!useSecure) return AsyncStorage.getItem(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    // Keystore entry unreadable (e.g. device lock/biometrics were reset):
    // treat as signed out rather than crashing on launch.
    return null;
  }
}

async function removeItem(key: string) {
  if (useSecure) await SecureStore.deleteItemAsync(key).catch(() => {});
  else await AsyncStorage.removeItem(key);
}

// One-time upgrade: earlier builds stored the tokens in plain AsyncStorage.
// Move them into the keystore and delete the plaintext copy so existing
// sessions survive the update and nothing sensitive is left behind.
let migration: Promise<void> | null = null;
function migrateLegacyTokens(): Promise<void> {
  if (!useSecure) return Promise.resolve();
  migration ??= (async () => {
    try {
      const legacy = await AsyncStorage.multiGet([ACCESS_KEY, REFRESH_KEY]);
      const [access, refresh] = [legacy[0]?.[1], legacy[1]?.[1]];
      if (!access && !refresh) return;
      if (access && !(await getItem(ACCESS_KEY))) await setItem(ACCESS_KEY, access);
      if (refresh && !(await getItem(REFRESH_KEY))) await setItem(REFRESH_KEY, refresh);
      await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
    } catch {
      // Leave the legacy copy in place and retry on next launch.
      migration = null;
    }
  })();
  return migration;
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await migrateLegacyTokens();
  await setItem(ACCESS_KEY, accessToken);
  await setItem(REFRESH_KEY, refreshToken);
}

export async function getAccessToken() {
  await migrateLegacyTokens();
  return getItem(ACCESS_KEY);
}

export async function getRefreshToken() {
  await migrateLegacyTokens();
  return getItem(REFRESH_KEY);
}

export async function clearTokens() {
  await migrateLegacyTokens();
  await removeItem(ACCESS_KEY);
  await removeItem(REFRESH_KEY);
  // Belt and braces: make sure no plaintext copy can outlive a logout.
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]).catch(() => {});
}
