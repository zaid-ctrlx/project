import { Frequency } from "../api/events";

// Display labels for how often a community repeats — no specific
// day-of-week/time-slot yet (see the Frequency type comment). Used by
// EventForm's "Recurring schedule" Select and EventDetailScreen's repeat row.
export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Daily",
  twice_a_week: "Twice a week",
  once_a_week: "Once a week",
  irregular: "Irregular",
};
