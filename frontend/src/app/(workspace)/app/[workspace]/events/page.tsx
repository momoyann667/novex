import { EventsView } from "@/features/events/events-view";

export default function EventsPage({ params }: Readonly<{ params: { workspace: string } }>) {
  return <EventsView workspaceSlug={params.workspace} />;
}
