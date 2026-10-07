import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import OptionsMenu from "../components/OptionsMenu";
import { EVENT_KIND_LABELS } from "../constants/eventKind";
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
// and creating either kind moved to Profile's top-left "+" button (see
// ProfileScreen).
//
// Home and Discover split what Events' old "Discover" sub-tab used to do:
// Discover (see DiscoverScreen) is search — events, communities, and
// accounts, all via one query. Home (see HomeScreen) is reserved for the
// actual recommendation feed (activity/follows/interests) — no browsing or
// search of its own, empty until that's built.
export type MainTabParamList = {
  Home: undefined;
  Discover: undefined;
  // Not a real screen — the center button just opens the create menu (see
  // CreateTabButton below), matching the design's raised "Create" action.
  Create: undefined;
  Messages: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "compass-outline",
  Discover: "navigate-outline",
  Create: "add",
  Messages: "chatbubble-outline",
  Profile: "person-circle-outline",
};

const ICONS_ACTIVE: Partial<Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap>> = {
  Home: "compass",
  Discover: "navigate",
  Messages: "chatbubble",
  Profile: "person-circle",
};

function Placeholder() {
  return null;
}

export default function MainTabs() {
  const { unreadTotal } = useMessaging();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
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
        name="Create"
        component={Placeholder}
        options={{
          tabBarButton: () => (
            <Pressable
              onPress={() => setCreateOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Create"
              style={{ flex: 1, alignItems: "center", justifyContent: "flex-start" }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  marginTop: -14,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  shadowColor: colors.primary,
                  shadowOpacity: 0.55,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 8,
                }}
              >
                <Ionicons name="add" size={28} color={colors.primaryText} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textFaint, marginTop: 4 }}>Create</Text>
            </Pressable>
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarBadge: unreadTotal > 0 ? unreadTotal : undefined, tabBarBadgeStyle: { backgroundColor: colors.secondary, color: colors.background } }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
    <OptionsMenu
      visible={createOpen}
      onClose={() => setCreateOpen(false)}
      title="Create"
      items={[
        { label: EVENT_KIND_LABELS.event, onPress: () => navigation.navigate("CreatePost", { kind: "event" }) },
        { label: EVENT_KIND_LABELS.community, onPress: () => navigation.navigate("CreatePost", { kind: "community" }) },
      ]}
    />
    </>
  );
}
