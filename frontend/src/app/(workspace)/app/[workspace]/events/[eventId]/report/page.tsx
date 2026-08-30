import { EventReportView } from "@/features/events/event-report-view";

export default function EventReportPage({ params }: Readonly<{ params: { workspace: string; eventId: string } }>) {
  return <EventReportView eventId={params.eventId} workspaceSlug={params.workspace} />;
}
