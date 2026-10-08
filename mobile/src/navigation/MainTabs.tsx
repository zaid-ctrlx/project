import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { useSafeInsets as useSafeAreaInsets } from "../hooks/useSafeInsets";

import { useMessaging } from "../context/MessagingContext";
import { useTheme } from "../context/ThemeContext";
import DiscoverScreen from "../screens/DiscoverScreen";
import HomeScreen from "../screens/HomeScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";

// Search used to be its own tab, but it only ever did user-lookup — which
// Discover's Accounts search (and MessagesScreen's inline "Search people to
// message" box) already covers. Having both was two ways to do the same
// thing, so this standalone tab is gone; SearchScreen.tsx is unused now.
//
// Events itself is gone entirely too — "My Posts" (events + communities
// you created) moved under Profile > Settings instead (see MyPostsScreen),
// and creating either kind lives only on Profile's top-left "+" button (see
// ProfileScreen) — the raised center "Create" tab that duplicated it is gone.
//
// Home and Discover split what Events' old "Discover" sub-tab used to do:
// Discover (see DiscoverScreen) is search — events, communities, and
// accounts, all via one query. Home (see HomeScreen) is reserved for the
// actual recommendation feed (activity/follows/interests) — no browsing or
// search of its own, empty until that's built.
export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "compass-outline",
  Discover: "navigate-outline",
  Messages: "chatbubble-outline",
  Profile: "person-circle-outline",
};

const ICONS_ACTIVE: Partial<Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap>> = {
  Home: "compass",
  Discover: "navigate",
  Messages: "chatbubble",
  Profile: "person-circle",
};

export default function MainTabs() {
  const { unreadTotal } = useMessaging();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ color, size, focused }) => {
          const name = route.name as keyof MainTabParamList;
          return <Ionicons name={focused ? ICONS_ACTIVE[name] ?? ICONS[name] : ICONS[name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined, tabBarBadgeStyle: { backgroundColor: colors.secondary, color: colors.background } }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
