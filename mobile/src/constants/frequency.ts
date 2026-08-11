import { Frequency } from "../api/events";

// Display labels for how often a community repeats — no specific
// day-of-week/time-slot yet (see the Frequency type comment). Used by
// EventForm's "How often" Select and EventDetailScreen's repeat row.
export const FREQUENCY_LABELS: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};
