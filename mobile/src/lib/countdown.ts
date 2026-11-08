// Human "how soon" labels for the plans agenda. Pure functions so they are
// easy to reason about: pass `now` explicitly (defaults to the current time).

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function startsInLabel(startsAtIso: string, now: number = Date.now()): string {
  const diff = new Date(startsAtIso).getTime() - now;
  if (diff <= 0) {
    const ago = -diff;
    if (ago < 3 * HOUR) return "Happening now";
    return "Started";
  }
  if (diff < HOUR) return `In ${Math.max(1, Math.round(diff / MINUTE))} min`;
  if (diff < DAY) {
    const h = Math.round(diff / HOUR);
    return h <= 1 ? "In 1 hour" : `In ${h} hours`;
  }
  const days = Math.floor(diff / DAY);
  return days === 1 ? "Tomorrow" : `In ${days} days`;
}

// Local calendar-day bucket used to group the agenda ("Today", "Tomorrow", or
// a dated heading).
export function dayHeading(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(now)) / DAY);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// Very short form for tight spots (e.g. a ring badge): "20m", "5h", "3d", "Now".
export function shortCountdown(startsAtIso: string, now: number = Date.now()): string {
  const diff = new Date(startsAtIso).getTime() - now;
  if (diff <= 0) return "Now";
  if (diff < HOUR) return `${Math.max(1, Math.round(diff / MINUTE))}m`;
  if (diff < DAY) return `${Math.round(diff / HOUR)}h`;
  return `${Math.floor(diff / DAY)}d`;
}
