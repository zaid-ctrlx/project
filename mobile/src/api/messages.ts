import { api, API_URL } from "./client";
import { getAccessToken } from "./storage";

export type MessageParticipant = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type MessageKind = "text" | "sticker";

export type Reaction = { user_id: string; emoji: string };

// Fields shared by DM and group messages (backend QuoteFields + the message
// feature columns). For kind="sticker", `body` is the sticker id.
export type MessageExtras = {
  kind: MessageKind;
  edited_at: string | null;
  // Delete-for-everyone leaves a tombstone: body is "" and this is set.
  deleted_at: string | null;
  forwarded: boolean;
  reactions: Reaction[];
  // Reply context. reply_to_id is only set for an in-thread reply (it is
  // null for a private reply to a group message); the quote_* snapshot is
  // set for every reply.
  reply_to_id: string | null;
  quote_text: string | null;
  quote_sender_id: string | null;
  quote_kind: string | null;
};

export type Message = MessageExtras & {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string; // ISO 8601
  read_at: string | null;
};

// Messages can only be edited for this long after sending - the server
// enforces it too (backend EDIT_WINDOW); this just hides the option.
export const EDIT_WINDOW_MS = 5 * 60 * 1000;

export function canEditMessage(m: { kind: MessageKind; created_at: string; deleted_at: string | null }): boolean {
  return m.kind === "text" && !m.deleted_at && Date.now() - new Date(m.created_at).getTime() <= EDIT_WINDOW_MS;
}

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
  group_avatar_url: string | null;
  // Whether this group backs a community rather than being a plain
  // user-created group chat — same distinction as api/groups.ts's
  // ChatGroup.is_community. Lets MessagesScreen filter by
  // DMs/Groups/Communities.
  is_community: boolean;
  member_count: number;
  last_message: string;
  last_message_at: string;
  // Null only for a just-created, still-empty group.
  last_sender_id: string | null;
  // Lets the row prefix its preview with "Sender: message" — null exactly
  // when last_sender_id is (empty group), never otherwise.
  last_sender_username: string | null;
  unread_count: number;
};

export type ConversationSummary = DmConversation | GroupConversation;

export type SendOptions = {
  kind?: MessageKind;
  forwarded?: boolean;
  replyToId?: string;
  // "Reply privately": id of a group message written by the recipient.
  privateReplyGroupMessageId?: string;
};

export function sendMessage(recipientId: string, text: string, opts: SendOptions = {}): Promise<Message> {
  return api.authed("/messages", {
    method: "POST",
    body: JSON.stringify({
      recipient_id: recipientId,
      text,
      kind: opts.kind ?? "text",
      forwarded: opts.forwarded ?? false,
      reply_to_id: opts.replyToId ?? null,
      private_reply_group_message_id: opts.privateReplyGroupMessageId ?? null,
    }),
  });
}

export function editMessage(messageId: string, text: string): Promise<Message> {
  return api.authed(`/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ text }) });
}

// Delete for everyone (sender only) - the row stays as a tombstone.
export function deleteMessage(messageId: string): Promise<Message> {
  return api.authed(`/messages/${messageId}`, { method: "DELETE" });
}

// One reaction per user per message; null removes mine.
export function reactToMessage(messageId: string, emoji: string | null): Promise<Message> {
  return api.authed(`/messages/${messageId}/reaction`, { method: "PUT", body: JSON.stringify({ emoji }) });
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

// One-sided — hides everything up to now from *this* user only; the other
// side's view is untouched. See backend DmClear's docstring.
export function clearDmChat(userId: string): Promise<void> {
  return api.authed(`/messages/with/${userId}/clear`, { method: "POST" });
}

// --- WebSocket ---
// API_URL already includes the /api/v1 prefix and an http(s) scheme (and is
// guaranteed non-empty by client.ts's own module-level check) — swap the
// scheme for ws(s) and append the route.
const WS_BASE = API_URL.replace(/^http/, "ws");

export async function buildMessagesSocketUrl(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;
  return `${WS_BASE}/messages/ws?token=${encodeURIComponent(token)}`;
}
