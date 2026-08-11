import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";

import { useMessaging } from "../context/MessagingContext";
import { useTheme } from "../context/ThemeContext";
import EventsScreen from "../screens/EventsScreen";
import HomeScreen from "../screens/HomeScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";

// Search used to be its own tab, but it only ever did user-lookup — which
// MessagesScreen's inline "Search people to message" box already covers
// (search -> straight into a chat). Having both was two ways to do the same
// thing, so this tab is gone; SearchScreen.tsx is unused now.
//
// Home carries the event discovery feed (was Events' "Discover" sub-tab);
// Events is now just "my events" (was reached via Events' ⋯ menu).
export type MainTabParamList = {
  Home: undefined;
  Messages: undefined;
  Events: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Messages: "paper-plane-outline",
  Events: "calendar-outline",
  Profile: "person-circle-outline",
};

export default function MainTabs() {
  const { unreadTotal } = useMessaging();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.borderLight },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof MainTabParamList]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined }}
      />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
