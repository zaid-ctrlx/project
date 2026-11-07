import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";

import FloatingTabBar from "../components/FloatingTabBar";
import { useMessaging } from "../context/MessagingContext";
import { useTheme } from "../context/ThemeContext";
import DiscoverScreen from "../screens/DiscoverScreen";
import HomeScreen from "../screens/HomeScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";

// Four tabs. Search is covered by Discover and Messages' own search, "My
// Posts" lives under Profile > Settings, and creating an event/community is
// Profile's top-left "+" button - so none of those needs a tab.
//
// The bar itself is a custom floating pill (components/FloatingTabBar) with a
// single orange active marker; icons/labels are defined there.
export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  const { unreadTotal } = useMessaging();
  const { colors } = useTheme();

  return (
    <Tab.Navigator tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Discover" component={DiscoverScreen} />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined, tabBarBadgeStyle: { backgroundColor: colors.primary, color: colors.primaryText } }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
