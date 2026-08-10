import { Event } from "../../api/events";
import EventForm from "../../components/EventForm";

type Props = { onCreated: (event: Event) => void };

export default function CreateEventView({ onCreated }: Props) {
  return <EventForm submitLabel="Create event" onSaved={onCreated} />;
}
