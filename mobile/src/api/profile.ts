import { api } from "./client";
import { Tag, User } from "./auth";

export function fetchTags(): Promise<Tag[]> {
  return api.authed("/tags");
}

export type ProfileUpdatePayload = {
  username: string;
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
  tags: Tag[];
};

export function searchUsers(query: string): Promise<UserSearchResult[]> {
  return api.authed(`/users/search?q=${encodeURIComponent(query)}`);
}
