import { api } from "./client";
import { MessageParticipant } from "./messages";
import { PickedAvatar } from "./profile";

export type GroupRole = "admin" | "member";

export type GroupMember = {
  user: MessageParticipant;
  role: GroupRole;
  joined_at: string;
  muted: boolean;
};

export type ChatGroup = {
  id: string;
  name: string;
  avatar_url: string | null;
  creator_id: string;
  created_at: string;
  members: GroupMember[];
  // Whether this group backs a community rather than being a plain
  // user-created group chat — lets GroupInfoScreen label itself
  // "Community Info" vs "Group Info".
  is_community: boolean;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  // Set on freshly-sent messages (POST response + WebSocket push) so the
  // Messages list can render "Sender: message" without a lookup — null on
  // history fetched via getGroupThread, which resolves names off the
  // group's already-loaded member list instead (see GroupChatScreen).
  sender_username: string | null;
};

export function createGroup(name: string, memberIds: string[]): Promise<ChatGroup> {
  return api.authed("/groups", {
    method: "POST",
    body: JSON.stringify({ name, member_ids: memberIds }),
  });
}

export function getGroup(groupId: string): Promise<ChatGroup> {
  return api.authed(`/groups/${groupId}`);
}

// Admin-only server-side (403 otherwise) — see routes/groups.py.
export function addGroupMember(groupId: string, userId: string): Promise<ChatGroup> {
  return api.authed(`/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

// Admin-only server-side; also rejects removing yourself (400) — see
// routes/groups.py's remove_group_member.
export function removeGroupMember(groupId: string, userId: string): Promise<ChatGroup> {
  return api.authed(`/groups/${groupId}/members/${userId}`, { method: "DELETE" });
}

// Admin-only server-side, same as addGroupMember. Called right after
// createGroup succeeds (from the same "Create group" button press) rather
// than folded into that request — there's no group id to save the file
// under until the group row exists. See CreateGroupScreen.
export function uploadGroupAvatar(groupId: string, asset: PickedAvatar): Promise<ChatGroup> {
  const ext = asset.mimeType.split("/")[1] ?? "jpg";
  const form = new FormData();
  form.append("file", asset.file, `avatar.${ext}`);
  return api.authed(`/groups/${groupId}/avatar`, { method: "POST", body: form });
}

// Admin-only server-side (403 otherwise). Deletes the group entirely —
// every member loses access and message history. If this group backs a
// community (see Event.group_id in the backend), the community post itself
// survives but loses its group link; a later join recreates a fresh one
// (see join_community in routes/events.py). Deleting the community itself
// is the separate deleteEvent call in api/events.ts.
export function deleteGroup(groupId: string): Promise<void> {
  return api.authed(`/groups/${groupId}`, { method: "DELETE" });
}

export function getGroupThread(groupId: string, limit = 30, offset = 0): Promise<GroupMessage[]> {
  return api.authed(`/groups/${groupId}/messages?limit=${limit}&offset=${offset}`);
}

export function sendGroupMessage(groupId: string, text: string): Promise<GroupMessage> {
  return api.authed(`/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
}

export function markGroupRead(groupId: string): Promise<void> {
  return api.authed(`/groups/${groupId}/read`, { method: "POST" });
}

// Per-member, not group-wide — gates only the notification system (in-app
// bell + OS push) for new messages in this group/community; muted members
// still get messages live if they have the chat open. See backend
// GroupMember.muted's docstring.
export function setGroupMuted(groupId: string, muted: boolean): Promise<ChatGroup> {
  return api.authed(`/groups/${groupId}/mute`, {
    method: "PATCH",
    body: JSON.stringify({ muted }),
  });
}

// One-sided — hides everything up to now from *this* member only; other
// members' views are untouched. See backend DmClear's docstring (same
// semantics, group side just has a per-membership column instead).
export function clearGroupChat(groupId: string): Promise<void> {
  return api.authed(`/groups/${groupId}/clear`, { method: "POST" });
}
