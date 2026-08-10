import { api, API_URL } from "./client";
import { getAccessToken } from "./storage";

export type MessageParticipant = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string; // ISO 8601
  read_at: string | null;
};

// GET /messages/conversations returns DMs and group chats merged into one
// newest-first list (see backend's ConversationOut) — `type` discriminates
// which fields are populated. Rendered by MessagesScreen, which narrows on
// `type` to pick the right icon/label/navigation target per row.
export type DmConversation = {
  type: "dm";
  other_user: MessageParticipant;
  last_message: string;
  last_message_at: string;
  last_sender_id: string;
  unread_count: number;
};

export type GroupConversation = {
  type: "group";
  group_id: string;
  group_name: string;
  member_count: number;
  last_message: string;
  last_message_at: string;
  // Null only for a just-created, still-empty group.
  last_sender_id: string | null;
  unread_count: number;
};

export type ConversationSummary = DmConversation | GroupConversation;

export function sendMessage(recipientId: string, text: string): Promise<Message> {
  return api.authed("/messages", {
    method: "POST",
    body: JSON.stringify({ recipient_id: recipientId, text }),
  });
}

export function listConversations(): Promise<ConversationSummary[]> {
  return api.authed("/messages/conversations");
}

export function getThread(userId: string, limit = 30, offset = 0): Promise<Message[]> {
  return api.authed(`/messages/with/${userId}?limit=${limit}&offset=${offset}`);
}

export function markThreadRead(userId: string): Promise<void> {
  return api.authed(`/messages/with/${userId}/read`, { method: "POST" });
}

// --- WebSocket ---
// API_URL already includes the /api/v1 prefix and an http(s) scheme (and is
// guaranteed non-empty by client.ts's own module-level check) — swap the
// scheme for ws(s) and append the route.
const WS_BASE = API_URL!.replace(/^http/, "ws");

export async function buildMessagesSocketUrl(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return `${WS_BASE}/messages/ws?token=${encodeURIComponent(token)}`;
}
