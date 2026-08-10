import { api } from "./client";
import { MessageParticipant } from "./messages";
import { PickedAvatar } from "./profile";

export type GroupRole = "admin" | "member";

export type GroupMember = {
  user: MessageParticipant;
  role: GroupRole;
  joined_at: string;
};

export type ChatGroup = {
  id: string;
  name: string;
  avatar_url: string | null;
  creator_id: string;
  created_at: string;
  members: GroupMember[];
};

export type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  created_at: string;
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

export function getGroupThread(groupId: string, limit = 30, offset = 0): Promise<GroupMessage[]> {
  return api.authed(`/groups/${groupId}/messages?limit=${limit}&offset=${offset}`);
}

export function sendGroupMessage(groupId: string, text: string): Promise<GroupMessage> {
  return api.authed(`/groups/${groupId}/messages`, { method: "POST", body: JSON.stringify({ text }) });
}

export function markGroupRead(groupId: string): Promise<void> {
  return api.authed(`/groups/${groupId}/read`, { method: "POST" });
}
