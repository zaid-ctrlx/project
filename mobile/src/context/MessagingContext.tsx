import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { GroupMessage, markGroupRead as markGroupReadApi } from "../api/groups";
import { buildMessagesSocketUrl, listConversations, markThreadRead, Message } from "../api/messages";
import { useAuth } from "./AuthContext";

type IncomingHandler = (message: Message) => void;
type IncomingGroupHandler = (message: GroupMessage) => void;

type MessagingState = {
  subscribe: (handler: IncomingHandler) => () => void;
  subscribeGroup: (handler: IncomingGroupHandler) => () => void;
  // Live edits / deletes / reactions on messages that already exist - kept
  // separate from subscribe/subscribeGroup so an updated message is never
  // mistaken for a new one (which would prepend it and bump the unread badge).
  subscribeUpdate: (handler: IncomingHandler) => () => void;
  subscribeGroupUpdate: (handler: IncomingGroupHandler) => () => void;
  setActiveThreadUserId: (userId: string | null) => void;
  isThreadActive: (userId: string) => boolean;
  setActiveGroupId: (groupId: string | null) => void;
  isGroupActive: (groupId: string) => boolean;
  unreadTotal: number;
  // Marks a thread read both server-side and in the locally-tracked total —
  // ChatScreen calls this instead of api/messages.ts's markThreadRead
  // directly, so the tab badge stays in sync without MessagesScreen needing
  // to be mounted (bottom-tabs lazy-mounts screens; this context is the one
  // thing guaranteed alive for the whole session).
  markRead: (userId: string, count: number) => Promise<void>;
  // Same idea, group side — GroupChatScreen/MessagesScreen call this
  // instead of api/groups.ts's markGroupRead directly.
  markGroupRead: (groupId: string, count: number) => Promise<void>;
};

const MessagingContext = createContext<MessagingState | undefined>(undefined);

const INITIAL_RETRY_MS = 2000;
const MAX_RETRY_MS = 30000;

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const listenersRef = useRef<Set<IncomingHandler>>(new Set());
  const groupListenersRef = useRef<Set<IncomingGroupHandler>>(new Set());
  const updateListenersRef = useRef<Set<IncomingHandler>>(new Set());
  const groupUpdateListenersRef = useRef<Set<IncomingGroupHandler>>(new Set());
  const activeThreadUserIdRef = useRef<string | null>(null);
  const activeGroupIdRef = useRef<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  // Which conversations (a person or a group) have something unread. The tab
  // badge shows how many conversations, not how many messages: 5 texts from one
  // person is still just 1.
  const [unreadKeys, setUnreadKeys] = useState<Set<string>>(() => new Set());
  const unreadTotal = unreadKeys.size;
  const addUnread = useCallback((key: string) => setUnreadKeys((prev) => (prev.has(key) ? prev : new Set(prev).add(key))), []);
  const clearUnread = useCallback(
    (key: string) =>
      setUnreadKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      }),
    []
  );

  useEffect(() => {
    if (!user) {
      setUnreadKeys(new Set());
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = INITIAL_RETRY_MS;

    // Seed the badge from the source of truth once per connect — the
    // running total after that is maintained purely from live pushes and
    // markRead/markGroupRead calls below, not re-fetched. listConversations
    // already merges DMs and groups (see api/messages.ts), so summing
    // unread_count here covers both without any group-specific fetch.
    listConversations()
      .then((conversations) => {
        if (!cancelled) {
          setUnreadKeys(
            new Set(
              conversations
                .filter((c) => c.unread_count > 0)
                .map((c) => (c.type === "dm" ? `dm:${c.other_user.id}` : `group:${c.group_id}`))
            )
          );
        }
      })
      .catch(() => {
        // Non-fatal — badge just starts at 0 and catches up via live pushes.
      });

    async function connect() {
      const url = await buildMessagesSocketUrl();
      if (!url || cancelled) return;

      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        retryDelay = INITIAL_RETRY_MS;
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "message" && payload.message) {
            const message = payload.message as Message;
            listenersRef.current.forEach((handler) => handler(message));
            if (activeThreadUserIdRef.current !== message.sender_id) {
              addUnread(`dm:${message.sender_id}`);
            }
          } else if (payload?.type === "group_message" && payload.message) {
            const message = payload.message as GroupMessage;
            groupListenersRef.current.forEach((handler) => handler(message));
            if (activeGroupIdRef.current !== message.group_id) {
              addUnread(`group:${message.group_id}`);
            }
          } else if (payload?.type === "message_updated" && payload.message) {
            updateListenersRef.current.forEach((handler) => handler(payload.message as Message));
          } else if (payload?.type === "group_message_updated" && payload.message) {
            groupUpdateListenersRef.current.forEach((handler) => handler(payload.message as GroupMessage));
          }
          // The server also pushes a "notification" frame type (new DM/group
          // message, added to a group — see backend app/core/notify.py) that
          // isn't handled here: there's no live badge/UI consuming it right
          // now (see NotificationsScreen, which just fetches on focus
          // instead). Falls through harmlessly if/when that comes back.
        } catch {
          // ignore malformed frames
        }
      };
      socket.onclose = () => {
        socketRef.current = null;
        if (cancelled) return;
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
      };
      socket.onerror = () => socket.close();
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [user?.id]);

  const subscribe = useCallback((handler: IncomingHandler) => {
    listenersRef.current.add(handler);
    return () => listenersRef.current.delete(handler);
  }, []);

  const subscribeGroup = useCallback((handler: IncomingGroupHandler) => {
    groupListenersRef.current.add(handler);
    return () => groupListenersRef.current.delete(handler);
  }, []);

  const subscribeUpdate = useCallback((handler: IncomingHandler) => {
    updateListenersRef.current.add(handler);
    return () => updateListenersRef.current.delete(handler);
  }, []);

  const subscribeGroupUpdate = useCallback((handler: IncomingGroupHandler) => {
    groupUpdateListenersRef.current.add(handler);
    return () => groupUpdateListenersRef.current.delete(handler);
  }, []);

  const setActiveThreadUserId = useCallback((userId: string | null) => {
    activeThreadUserIdRef.current = userId;
  }, []);

  const isThreadActive = useCallback((userId: string) => activeThreadUserIdRef.current === userId, []);

  const setActiveGroupId = useCallback((groupId: string | null) => {
    activeGroupIdRef.current = groupId;
  }, []);

  const isGroupActive = useCallback((groupId: string) => activeGroupIdRef.current === groupId, []);

  // `count` is no longer needed (the badge counts conversations) but is kept so
  // existing callers don't change.
  const markRead = useCallback(async (userId: string, _count: number) => {
    clearUnread(`dm:${userId}`);
    try {
      await markThreadRead(userId);
    } catch {
      // Best-effort — a failed mark-as-read just means it's retried next
      // time the thread is opened; not worth reverting the local badge for.
    }
  }, [clearUnread]);

  const markGroupRead = useCallback(async (groupId: string, _count: number) => {
    clearUnread(`group:${groupId}`);
    try {
      await markGroupReadApi(groupId);
    } catch {
      // Same best-effort tradeoff as markRead above.
    }
  }, [clearUnread]);

  return (
    <MessagingContext.Provider
      value={{
        subscribe,
        subscribeGroup,
        subscribeUpdate,
        subscribeGroupUpdate,
        setActiveThreadUserId,
        isThreadActive,
        setActiveGroupId,
        isGroupActive,
        unreadTotal,
        markRead,
        markGroupRead,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error("useMessaging must be used within a MessagingProvider");
  return ctx;
}
