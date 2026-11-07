import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { useEffect } from "react";
import { Platform } from "react-native";

import { registerPushToken, unregisterPushToken } from "../api/notifications";
import type { AppStackParamList } from "../navigation/AppStack";
import { routeNotification } from "../navigation/routeNotification";

// OS push notifications: registers this device's Expo push token with the
// backend, and routes a tap on a delivered notification to the right screen.
//
// expo-notifications is loaded lazily and NEVER inside Expo Go: importing it
// there crashes the Android app (push support was removed from Expo Go in SDK
// 53+). So in Expo Go and on web this whole module is a safe no-op and the
// app behaves exactly as before; in a development build or a release build
// it is fully active. Real push delivery additionally needs an EAS project id
// (see README, "Push notifications").
type NotificationsModule = typeof import("expo-notifications");

function pushSupported(): boolean {
  return Platform.OS !== "web" && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

function load(): NotificationsModule | null {
  if (!pushSupported()) return null;
  try {
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

let registeredToken: string | null = null;

async function register(N: NotificationsModule) {
  try {
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("default", {
        name: "default",
        importance: N.AndroidImportance.DEFAULT,
      });
    }
    let { status } = await N.getPermissionsAsync();
    if (status !== "granted") status = (await N.requestPermissionsAsync()).status;
    if (status !== "granted") return; // user said no - in-app notifications still work

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return; // no EAS project configured yet, so no push token can be issued
    const { data: token } = await N.getExpoPushTokenAsync({ projectId });
    await registerPushToken(token); // idempotent server-side
    registeredToken = token;
  } catch {
    // Push is best-effort; never let it break sign-in or the UI.
  }
}

// Call before clearing tokens on logout so this device stops receiving the
// signed-out account's pushes.
export async function unregisterPush() {
  const token = registeredToken;
  registeredToken = null;
  if (token) await unregisterPushToken(token).catch(() => {});
}

// Mounted once inside the signed-in app (AppStack), where navigation exists.
export function usePushNotifications() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  useEffect(() => {
    const N = load();
    if (!N) return;

    register(N);

    function handle(response: import("expo-notifications").NotificationResponse | null) {
      if (!response) return;
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data?.type) return;
      routeNotification(navigation, data.type, data, response.notification.request.content.title ?? "");
    }

    // Tap while the app is running / in the background...
    const sub = N.addNotificationResponseReceivedListener(handle);
    // ...and the tap that launched the app from a closed state.
    handle(N.getLastNotificationResponse());
    N.clearLastNotificationResponse?.();

    return () => sub.remove();
  }, [navigation]);
}
