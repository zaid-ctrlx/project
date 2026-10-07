import AsyncStorage from "@react-native-async-storage/async-storage";

// Home feed filters. They are independent and combine (AND): a location (+
// radius around it), a sort order, and an inclusive date range. The location
// here is a *feed-only* override — it never touches the profile location.
export type FilterLocation = { label: string; lat: number; lng: number };
export type SortKey = "soonest" | "nearest" | "recent";

export type FeedFilters = {
  // null = use the profile location as the origin.
  location: FilterLocation | null;
  // null = no distance limit.
  radiusKm: number | null;
  // Inclusive local calendar days as "YYYY-MM-DD"; either may be null.
  from: string | null;
  to: string | null;
  sort: SortKey;
};

export const DEFAULT_FILTERS: FeedFilters = { location: null, radiusKm: null, from: null, to: null, sort: "soonest" };

export const SORT_LABELS: Record<SortKey, string> = {
  soonest: "Soonest",
  nearest: "Nearest",
  recent: "Recently added",
};

export const RADIUS_CHOICES: (number | null)[] = [null, 5, 10, 20, 30, 50];

// Number of filters currently narrowing/reordering the feed (drives the
// badge on the Filters button).
export function activeFilterCount(f: FeedFilters): number {
  let n = 0;
  if (f.location) n += 1;
  if (f.radiusKm !== null) n += 1;
  if (f.from || f.to) n += 1;
  if (f.sort !== "soonest") n += 1;
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
      radiusKm: typeof parsed.radiusKm === "number" ? parsed.radiusKm : null,
      from: typeof parsed.from === "string" ? parsed.from : null,
      to: typeof parsed.to === "string" ? parsed.to : null,
      sort: parsed.sort === "nearest" || parsed.sort === "recent" ? parsed.sort : "soonest",
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
