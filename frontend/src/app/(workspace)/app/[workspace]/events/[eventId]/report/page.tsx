import { EventReportView } from "@/features/events/event-report-view";

export default async function EventReportPage({ params }: Readonly<{ params: Promise<{ workspace: string; eventId: string }> }>) {
  const { workspace, eventId } = await params;
  return <EventReportView eventId={eventId} workspaceSlug={workspace} />;
}
