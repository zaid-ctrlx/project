import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";

import { useMessaging } from "../context/MessagingContext";
import EventsScreen from "../screens/EventsScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { colors } from "../theme";

// Search used to be its own tab, but it only ever did user-lookup — which
// MessagesScreen's inline "Search people to message" box already covers
// (search -> straight into a chat). Having both was two ways to do the same
// thing, so this tab is gone; SearchScreen.tsx is unused now.
export type MainTabParamList = {
  Messages: undefined;
  Events: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Messages: "paper-plane-outline",
  Events: "calendar-outline",
  Profile: "person-circle-outline",
};

export default function MainTabs() {
  const { unreadTotal } = useMessaging();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { borderTopColor: colors.borderLight },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof MainTabParamList]} size={size} color={color} />
        ),
      })}
    >
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
