import { EventDetailView } from "@/features/events/event-detail-view";

export default function EventDetailPage({ params }: Readonly<{ params: { workspace: string; eventId: string } }>) {
  return <EventDetailView eventId={params.eventId} workspaceSlug={params.workspace} />;
}
