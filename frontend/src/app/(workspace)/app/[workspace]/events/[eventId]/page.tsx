import { EventDetailView } from "@/features/events/event-detail-view";

export default async function EventDetailPage({ params }: Readonly<{ params: Promise<{ workspace: string; eventId: string }> }>) {
  const { workspace, eventId } = await params;
  return <EventDetailView eventId={eventId} workspaceSlug={workspace} />;
}
