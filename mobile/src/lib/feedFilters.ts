import AsyncStorage from "@react-native-async-storage/async-storage";

// Home feed filters. They are independent and combine (AND): a location (+
// radius around it), a sort order, and an inclusive date range. The location
// here is a *feed-only* override — it never touches the profile location.
export type FilterLocation = { label: string; lat: number; lng: number };
export type SortKey = "soonest" | "nearest" | "recent";
// Which kinds of posts to show: both, only events, or only communities.
export type KindFilter = "all" | "event" | "community";

export type FeedFilters = {
  // null = use the profile location as the origin.
  location: FilterLocation | null;
  // null = no distance limit.
  radiusKm: number | null;
  // Inclusive local calendar days as "YYYY-MM-DD"; either may be null.
  from: string | null;
  to: string | null;
  sort: SortKey;
  kind: KindFilter;
};

export const DEFAULT_FILTERS: FeedFilters = {
  location: null,
  radiusKm: null,
  from: null,
  to: null,
  sort: "soonest",
  kind: "all",
};

export const KIND_FILTER_LABELS: Record<KindFilter, string> = {
  all: "Events & communities",
  event: "Events only",
  community: "Communities only",
};

export const SORT_LABELS: Record<SortKey, string> = {
  soonest: "Soonest",
  nearest: "Nearest",
  recent: "Recently added",
};

// "Nearby" first, "Anywhere" (no limit) last.
export const RADIUS_CHOICES: (number | null)[] = [15, 50, 100, 150, null];
export const NEARBY_KM = 15;

export function radiusLabel(km: number | null): string {
  if (km === null) return "Anywhere";
  return km === NEARBY_KM ? `Nearby · ${km} km` : `${km} km`;
}

// Short wording for the removable chip on Home.
export function radiusChipLabel(km: number): string {
  return km === NEARBY_KM ? `Nearby (${km} km)` : `Within ${km} km`;
}

// Radii saved by older versions (5/10/20/30...) snap to the next available
// choice so the saved filter still matches one of the options.
function snapRadius(km: number): number | null {
  const choices = RADIUS_CHOICES.filter((c): c is number => c !== null);
  return choices.find((c) => c >= km) ?? null;
}

// Number of filters currently narrowing/reordering the feed (drives the
// badge on the Filters button).
export function activeFilterCount(f: FeedFilters): number {
  let n = 0;
  if (f.location) n += 1;
  if (f.radiusKm !== null) n += 1;
  if (f.from || f.to) n += 1;
  if (f.sort !== "soonest") n += 1;
  if (f.kind !== "all") n += 1;
  return n;
}

export function toDayString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "YYYY-MM-DD" -> local Date at the given time of day.
export function dayStart(day: string): Date {
  return new Date(`${day}T00:00:00`);
}
export function dayEnd(day: string): Date {
  return new Date(`${day}T23:59:59.999`);
}

export function formatDay(day: string): string {
  return dayStart(day).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const STORAGE_KEY = "home_filters_v1";

export async function loadFilters(): Promise<FeedFilters> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const parsed = JSON.parse(raw);
    return {
      location:
        parsed.location && typeof parsed.location.lat === "number" && typeof parsed.location.lng === "number"
          ? { label: String(parsed.location.label ?? ""), lat: parsed.location.lat, lng: parsed.location.lng }
          : null,
      radiusKm: typeof parsed.radiusKm === "number" ? snapRadius(parsed.radiusKm) : null,
      from: typeof parsed.from === "string" ? parsed.from : null,
      to: typeof parsed.to === "string" ? parsed.to : null,
      sort: parsed.sort === "nearest" || parsed.sort === "recent" ? parsed.sort : "soonest",
      kind: parsed.kind === "event" || parsed.kind === "community" ? parsed.kind : "all",
    };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function saveFilters(f: FeedFilters): void {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(f)).catch(() => {
    // preference just will not persist
  });
}
