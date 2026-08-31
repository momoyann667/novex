import { EventNewView } from "@/features/events/event-new-view";

export default function NewEventPage({ params }: Readonly<{ params: { workspace: string } }>) {
  return <EventNewView workspaceSlug={params.workspace} />;
}
