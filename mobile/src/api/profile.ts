import { api } from "./client";
import { Tag, User } from "./auth";

export function fetchTags(): Promise<Tag[]> {
  return api.authed("/tags");
}

export type ProfileUpdatePayload = {
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
