import { api } from "./client";
import { Gender, Tag, User } from "./auth";

export function fetchTags(): Promise<Tag[]> {
  return api.authed("/tags");
}

export type ProfileUpdatePayload = {
  full_name: string | null;
  username: string;
  bio: string | null;
  gender: Gender | null;
  location_lat: number;
  location_lng: number;
  location_label: string;
  tag_ids: string[];
};

export function updateProfile(payload: ProfileUpdatePayload): Promise<User> {
  return api.authed("/users/me/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export type UserSearchResult = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  tags: Tag[];
};

export function searchUsers(query: string): Promise<UserSearchResult[]> {
  return api.authed(`/users/search?q=${encodeURIComponent(query)}`);
}

// What one user is allowed to see of another's profile — deliberately
// excludes email/gender/location, mirroring the backend's UserPublicOut.
export type PublicProfile = {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  tags: Tag[];
  // Whether *I* have blocked this user — see UserPublicOut.is_blocked.
  is_blocked: boolean;
};

export function getUserProfile(userId: string): Promise<PublicProfile> {
  return api.authed(`/users/${userId}`);
}

export function deleteAccount(password: string): Promise<void> {
  return api.authed("/users/me", { method: "DELETE", body: JSON.stringify({ password }) });
}

export type BlockedUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

export function getBlockedUsers(): Promise<BlockedUser[]> {
  return api.authed("/users/me/blocked");
}

export function blockUser(userId: string): Promise<void> {
  return api.authed(`/users/${userId}/block`, { method: "POST" });
}

export function unblockUser(userId: string): Promise<void> {
  return api.authed(`/users/${userId}/block`, { method: "DELETE" });
}

export type PickedAvatar = {
  // A real Blob (web) or an expo-file-system File (native, structurally
  // Blob-like via .bytes()) — NOT the classic React Native {uri,name,type}
  // shorthand. Since SDK 52+, Expo installs its own spec-compliant global
  // fetch/FormData on native (see expo/src/winter/runtime.native.ts),
  // which only accepts a real Blob-like part and throws "Unsupported
  // FormDataPart implementation" for the old RN shorthand object.
  file: Blob;
  mimeType: string;
};

export function uploadAvatar(asset: PickedAvatar): Promise<User> {
  const ext = asset.mimeType.split("/")[1] ?? "jpg";
  const form = new FormData();
  form.append("file", asset.file, `avatar.${ext}`);
  return api.authed("/users/me/avatar", { method: "POST", body: form });
}
