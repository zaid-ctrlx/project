import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { Event } from "../api/events";
import AddGroupMemberScreen from "../screens/AddGroupMemberScreen";
import ChatScreen from "../screens/ChatScreen";
import CreateGroupScreen from "../screens/CreateGroupScreen";
import EventDetailScreen from "../screens/EventDetailScreen";
import GroupChatScreen from "../screens/GroupChatScreen";
import SettingsScreen from "../screens/SettingsScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import MainTabs from "./MainTabs";

// Wraps the bottom tabs in a stack so screens reachable from a tab (e.g.
// Settings, pushed from Profile; Chat/CreateGroup/GroupChat, pushed from
// Messages; EventDetail, pushed from Events) can slide in over the tab bar
// instead of needing to be a tab themselves.
export type AppStackParamList = {
  Tabs: undefined;
  Settings: undefined;
  Chat: { userId: string; username: string; avatarUrl: string | null };
  UserProfile: { userId: string };
  EventDetail: { event: Event };
  CreateGroup: undefined;
  // unreadCount is optional — passed by MessagesScreen (which already knows
  // it from the conversation list) so the tab badge can be decremented by
  // exactly the right amount on open. Group messages carry no per-message
  // read state (unlike DMs), so unlike ChatScreen this can't be recomputed
  // from the thread itself; omit it (e.g. opening a just-created group)
  // and nothing is marked read.
  GroupChat: { groupId: string; groupName: string; memberCount: number; unreadCount?: number };
  AddGroupMember: { groupId: string };
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="AddGroupMember" component={AddGroupMemberScreen} />
    </Stack.Navigator>
  );
}
