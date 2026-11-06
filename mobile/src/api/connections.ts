import { api } from "./client";
import type { UserSearchResult } from "./profile";

// "none" | I asked them | they asked me | mutually connected
export type ConnectionStatus = "none" | "pending_out" | "pending_in" | "connected";

export function listConnections(): Promise<UserSearchResult[]> {
  return api.authed("/connections");
}

export function listConnectionRequests(): Promise<UserSearchResult[]> {
  return api.authed("/connections/requests");
}

// Requests I've sent that nobody has answered yet.
export function listSentRequests(): Promise<UserSearchResult[]> {
  return api.authed("/connections/sent");
}

export function sendConnectionRequest(userId: string): Promise<{ status: ConnectionStatus }> {
  return api.authed(`/connections/${userId}`, { method: "POST" });
}

export function acceptConnection(userId: string): Promise<{ status: ConnectionStatus }> {
  return api.authed(`/connections/${userId}/accept`, { method: "POST" });
}

// Cancel my request, decline theirs, or disconnect -- one call for all three.
export function removeConnection(userId: string): Promise<{ status: ConnectionStatus }> {
  return api.authed(`/connections/${userId}`, { method: "DELETE" });
}
