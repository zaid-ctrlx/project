// Shared by ChatScreen and GroupChatScreen's "Search" menu item — both
// message shapes (api/messages.ts's Message, api/groups.ts's GroupMessage)
// have a `body: string`, so one generic filter covers both instead of each
// screen writing its own. Searches only messages already loaded into the
// screen (no dedicated backend search endpoint) — scroll up to load more
// history first if what you're after isn't showing.
export function filterMessagesByText<T extends { body: string }>(messages: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return messages;
  return messages.filter((m) => m.body.toLowerCase().includes(q));
}
