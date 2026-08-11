import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";

import { Event, EventKind } from "../api/events";
import { useTheme } from "../context/ThemeContext";
import AddGroupMemberScreen from "../screens/AddGroupMemberScreen";
import BookmarksScreen from "../screens/BookmarksScreen";
import ChatScreen from "../screens/ChatScreen";
import ContactInfoScreen from "../screens/ContactInfoScreen";
import CreateGroupScreen from "../screens/CreateGroupScreen";
import CreatePostScreen from "../screens/CreatePostScreen";
import EditEventScreen from "../screens/EditEventScreen";
import EventDetailScreen from "../screens/EventDetailScreen";
import EventSearchScreen from "../screens/EventSearchScreen";
import GroupChatScreen from "../screens/GroupChatScreen";
import GroupInfoScreen from "../screens/GroupInfoScreen";
import MessageSearchScreen from "../screens/MessageSearchScreen";
import MyPostsScreen from "../screens/MyPostsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import UserProfileScreen from "../screens/UserProfileScreen";
import MainTabs from "./MainTabs";

// Wraps the bottom tabs in a stack so screens reachable from a tab (e.g.
// Settings/Bookmarks/MyPosts, pushed from Profile; Chat/CreateGroup/
// GroupChat/MessageSearch, pushed from Messages; EventDetail/EditEvent/
// EventSearch, pushed from Home; CreatePost, pushed from Profile's top-left
// button) can slide in over the tab bar instead of needing to be a tab
// themselves — EventSearch and MessageSearch lean on this specifically so
// starting a search hides the tab bar and can only be left via swipe-back/
// the hardware back button/the header back arrow, not by switching tabs.
export type AppStackParamList = {
  Tabs: undefined;
  Settings: undefined;
  // Pushed from Settings ("My bookmarks" row).
  Bookmarks: undefined;
  // Pushed from Settings ("My Posts" row) — everything (events + communities)
  // the current user created. There's no more Events tab for this to live
  // under (see MainTabs).
  MyPosts: undefined;
  Chat: { userId: string; username: string; avatarUrl: string | null };
  UserProfile: { userId: string };
  EventDetail: { event: Event };
  // Pushed from Home's search bar (see EventDiscoverView.onRequestSearch).
  EventSearch: undefined;
  // Pushed from Messages' search bar.
  MessageSearch: undefined;
  // Pushed from Profile's top-left "+" button, which opens a picker
  // (Event vs Community) first — see ProfileScreen.
  CreatePost: { kind: EventKind };
  // Pushed from My Posts' Edit action — full event, not just an id, same
  // reasoning as EventDetail (already fetched, no round trip needed).
  EditEvent: { event: Event };
  CreateGroup: undefined;
  // unreadCount is optional — passed by MessagesScreen (which already knows
  // it from the conversation list) so the tab badge can be decremented by
  // exactly the right amount on open. Group messages carry no per-message
  // read state (unlike DMs), so unlike ChatScreen this can't be recomputed
  // from the thread itself; omit it (e.g. opening a just-created group)
  // and nothing is marked read.
  GroupChat: { groupId: string; groupName: string; memberCount: number; unreadCount?: number };
  AddGroupMember: { groupId: string };
  // Pushed by tapping the group name in GroupChatScreen's header.
  GroupInfo: { groupId: string };
  // Pushed from GroupInfo's member list. groupId (not just userId) because
  // "Remove from group" is a group-scoped action, and it's the same screen
  // used from any group's member list.
  ContactInfo: { groupId: string; userId: string };
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Tabs" component={MainTabs} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Bookmarks" component={BookmarksScreen} />
      <Stack.Screen name="MyPosts" component={MyPostsScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="EventSearch" component={EventSearchScreen} />
      <Stack.Screen name="MessageSearch" component={MessageSearchScreen} />
      <Stack.Screen name="CreatePost" component={CreatePostScreen} />
      <Stack.Screen name="EditEvent" component={EditEventScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="AddGroupMember" component={AddGroupMemberScreen} />
      <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
      <Stack.Screen name="ContactInfo" component={ContactInfoScreen} />
    </Stack.Navigator>
  );
}
